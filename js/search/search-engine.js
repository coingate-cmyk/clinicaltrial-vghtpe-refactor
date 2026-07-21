(function (root, factory) {
    let classifier;
    let registry;
    if (typeof module === 'object' && module.exports) {
        classifier = require('./biomarker-classifier.js');
        registry = require('./biomarker-registry.js');
        require('./biomarker-expression-rules.js');
        require('./biomarker-genomic-rules.js');
    } else {
        classifier = (root.ClinicalTrialApp && root.ClinicalTrialApp.search) || {};
        registry = classifier;
    }
    const api = factory(classifier, registry);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.search = Object.assign(root.ClinicalTrialApp.search || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (classifier, registry) {
    'use strict';

    const normalize = (value) => classifier.normalizeUnicode(value).toLowerCase().replace(/[\s　]+/g, ' ').trim();
    const normalizeCompact = (value) => normalize(value).replace(/[\s\-_/()（）:：.]+/g, '');

    const parseSearchQuery = (query) => {
        const raw = classifier.normalizeUnicode(query).trim();
        let remaining = raw;
        const filters = [];
        const her2Definitions = [
            { status: 'low', regex: /(?:\bHER\s*-?\s*2\s*[- ]?low\b|HER\s*-?\s*2\s*低表現|HER2LOW)/ig },
            { status: 'nonPositive', regex: /(?:\bHER\s*-?\s*2\s*non[- ]?positive\b|HER\s*-?\s*2\s*非陽性)/ig },
            { status: 'positive', regex: /(?:\bHER\s*-?\s*2\s*\+|\bHER\s*-?\s*2\s*(?:positive|postive|positve)\b|HER\s*-?\s*2\s*陽性|HER2\+)/ig },
            { status: 'negative', regex: /(?:\bHER\s*-?\s*2\s*(?:negative|negatve)\b|HER\s*-?\s*2\s*陰性|HER2-(?!low))/ig },
            { status: 'anyMention', regex: /(?:\bHER\s*-?\s*2\b|\bERBB\s*2\b)/ig }
        ];
        for (const definition of her2Definitions) {
            if (!definition.regex.test(remaining)) continue;
            filters.push({ type: 'biomarker', marker: 'HER2', status: definition.status });
            remaining = remaining.replace(definition.regex, ' ');
            break;
        }
        if (registry && typeof registry.parseRegisteredBiomarkerQuery === 'function') {
            const parsedRegistry = registry.parseRegisteredBiomarkerQuery(remaining);
            filters.push(...parsedRegistry.filters);
            remaining = parsedRegistry.remaining;
        }
        return { raw, freeText: remaining.replace(/\s+/g, ' ').trim(), filters };
    };

    const trialFields = (trial) => [
        { name: 'code', value: trial && trial.code, weight: 120 },
        { name: 'title', value: trial && (trial.title || trial.studyTitle), weight: 80 },
        { name: 'cancerType', value: [
            trial && trial.cancerType,
            Array.isArray(trial && trial.cancerTypes) ? trial.cancerTypes.map((item) => `${item.type || ''} ${(item.lines || []).join(' ')}`).join(' ') : ''
        ].join(' '), weight: 65 },
        { name: 'treatmentLines', value: Array.isArray(trial && trial.treatmentLines) ? trial.treatmentLines.join(' ') : '', weight: 62 },
        { name: 'interventions', value: Array.isArray(trial && trial.interventions) ? trial.interventions.join(' ') : '', weight: 60 },
        { name: 'sponsor', value: trial && trial.sponsor, weight: 55 },
        { name: 'pi', value: trial && ((trial.contacts && trial.contacts.pi) || trial.pi), weight: 50 },
        { name: 'nurse', value: trial && ((trial.contacts && trial.contacts.nurse) || trial.nurse), weight: 40 },
        { name: 'summary', value: trial && trial.summary, weight: 30 },
        { name: 'notes', value: trial && (trial.notes || trial.comments), weight: 25 },
        { name: 'inclusion', value: trial && trial.inclusion, weight: 20 },
        { name: 'exclusion', value: trial && trial.exclusion, weight: 10 }
    ];

    const scoreFreeText = (trial, freeText) => {
        if (!freeText) return { matched: true, score: 0, reasons: [] };
        const terms = normalize(freeText).split(' ').filter(Boolean);
        const reasons = [];
        let score = 0;
        for (const term of terms) {
            const compactTerm = normalizeCompact(term);
            let termMatched = false;
            for (const field of trialFields(trial)) {
                const normalizedValue = normalize(field.value);
                const compactValue = normalizeCompact(field.value);
                if (!normalizedValue) continue;
                if (normalizedValue.includes(term) || (compactTerm && compactValue.includes(compactTerm))) {
                    termMatched = true;
                    let fieldScore = field.weight;
                    if (field.name === 'code' && compactValue === compactTerm) fieldScore += 100;
                    score += fieldScore;
                    reasons.push({ type: 'text', field: field.name, term, score: fieldScore });
                    break;
                }
            }
            if (!termMatched) return { matched: false, score: 0, reasons: [] };
        }
        return { matched: true, score, reasons };
    };

    const evaluateTrialSearch = (trial, query) => {
        const parsed = typeof query === 'string' ? parseSearchQuery(query) : query;
        const reasons = [];
        const biomarkers = {};
        let score = 0;
        for (const filter of parsed.filters || []) {
            let matched = false;
            let classification;
            if (filter.marker === 'HER2') {
                classification = classifier.classifyHER2(trial);
                matched = classifier.matchesHER2Status(classification, filter.status);
            } else if (registry && typeof registry.evaluateBiomarkerFilter === 'function') {
                const evaluated = registry.evaluateBiomarkerFilter(trial, filter);
                classification = evaluated.classification;
                matched = evaluated.matched;
            }
            biomarkers[filter.marker] = classification;
            if (!matched) return { matched: false, score: 0, reasons: [], parsed, biomarkers };
            score += filter.status === 'anyMention' ? 30 : 90;
            reasons.push({
                type: 'biomarker',
                marker: filter.marker,
                status: filter.status,
                threshold: filter.threshold,
                summary: classification && classification.summary,
                evidence: classification && classification.mentions ? classification.mentions.slice(0, 3) : []
            });
        }
        const freeTextResult = scoreFreeText(trial, parsed.freeText || '');
        if (!freeTextResult.matched) return { matched: false, score: 0, reasons: [], parsed, biomarkers };
        score += freeTextResult.score;
        reasons.push(...freeTextResult.reasons);
        return { matched: true, score, reasons, parsed, biomarkers };
    };

    const searchTrials = (trials, query) => (Array.isArray(trials) ? trials : [])
        .map((trial, index) => ({ trial, index, result: evaluateTrialSearch(trial, query) }))
        .filter((item) => item.result.matched)
        .sort((a, b) => b.result.score - a.result.score || a.index - b.index);

    return { parseSearchQuery, evaluateTrialSearch, searchTrials };
});