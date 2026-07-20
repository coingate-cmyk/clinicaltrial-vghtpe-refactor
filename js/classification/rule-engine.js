(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports
        ? require('../core/normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(normalization);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.classification = Object.assign(root.ClinicalTrialApp.classification || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization) {
    'use strict';

    function buildTextSources(trial) {
        const item = trial || {};
        const cancerText = Array.isArray(item.cancerTypes)
            ? item.cancerTypes.map((entry) => `${entry.type || ''} ${(entry.lines || []).join(' ')}`).join('\n')
            : '';
        return [
            { field: 'title', text: item.title || item.studyTitle || '', weight: 1.0 },
            { field: 'shortTitle', text: item.shortTitle || '', weight: 0.95 },
            { field: 'cancerTypes', text: cancerText, weight: 1.0 },
            { field: 'summary', text: item.summary || '', weight: 0.85 },
            { field: 'inclusion', text: item.inclusion || '', weight: 0.9 },
            { field: 'exclusion', text: item.exclusion || '', weight: 0.55 },
            { field: 'notes', text: item.notes || item.comments || '', weight: 0.6 }
        ].map((source) => Object.assign(source, { text: normalization.normalizeWhitespace(source.text) })).filter((source) => source.text);
    }

    function patternEvidence(text, patterns) {
        const findings = [];
        (patterns || []).forEach((pattern) => {
            const flags = pattern instanceof RegExp ? pattern.flags : 'i';
            const regex = pattern instanceof RegExp
                ? new RegExp(pattern.source, flags.includes('g') ? flags : `${flags}g`)
                : new RegExp(String(pattern), 'ig');
            let match;
            while ((match = regex.exec(text)) !== null) {
                findings.push({ match: match[0], index: match.index });
                if (match[0] === '') regex.lastIndex += 1;
            }
        });
        return findings;
    }

    function evaluateRules(trial, rules, options) {
        const opts = Object.assign({ allowMultiple: true, minimumConfidence: 0.5 }, options || {});
        const sources = buildTextSources(trial);
        const results = [];

        (rules || []).forEach((rule) => {
            const evidence = [];
            let score = 0;
            sources.forEach((source) => {
                const positives = patternEvidence(source.text, rule.patterns);
                const negatives = patternEvidence(source.text, rule.negationPatterns);
                if (!positives.length) return;
                positives.forEach((finding) => {
                    const start = Math.max(0, finding.index - 55);
                    const end = Math.min(source.text.length, finding.index + finding.match.length + 90);
                    evidence.push({ field: source.field, match: finding.match, excerpt: source.text.slice(start, end), weight: source.weight });
                    score += (rule.weight || 1) * source.weight;
                });
                score -= negatives.length * (rule.negationWeight || 1.2) * source.weight;
            });
            if (!evidence.length || score <= 0) return;
            const confidence = Math.max(0, Math.min(0.99, 0.45 + (score / (score + 2.5))));
            if (confidence < opts.minimumConfidence) return;
            results.push({ id: rule.id, value: rule.value, category: rule.category || '', priority: rule.priority || 0, confidence, score, evidence });
        });

        results.sort((a, b) => b.priority - a.priority || b.score - a.score || b.confidence - a.confidence);
        return opts.allowMultiple ? results : results.slice(0, 1);
    }

    return { buildTextSources, patternEvidence, evaluateRules };
});