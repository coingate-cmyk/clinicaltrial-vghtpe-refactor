(function (root, factory) {
    const base = typeof module === 'object' && module.exports
        ? require('./biomarker-classifier.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.search) || {};
    const api = factory(base);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.search = Object.assign(root.ClinicalTrialApp.search || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (base) {
    'use strict';

    const definitions = new Map();
    const normalize = (value) => base.normalizeUnicode(value).replace(/[\t ]+/g, ' ').trim();
    const unique = (values) => Array.from(new Set(values));
    const safeTest = (regex, text) => new RegExp(regex.source, regex.flags.replace(/g/g, '')).test(text);

    function registerBiomarker(definition) {
        if (!definition || !definition.marker) throw new TypeError('A biomarker marker is required.');
        const marker = String(definition.marker).toUpperCase();
        definitions.set(marker, Object.assign({}, definition, { marker }));
        return definitions.get(marker);
    }

    function getBiomarkerDefinition(marker) {
        return definitions.get(String(marker || '').toUpperCase()) || null;
    }

    function listBiomarkerDefinitions() {
        return Array.from(definitions.values());
    }

    function parseRegisteredBiomarkerQuery(query) {
        let remaining = normalize(query);
        const filters = [];
        for (const definition of definitions.values()) {
            for (const queryRule of definition.queryRules || []) {
                if (!safeTest(queryRule.regex, remaining)) continue;
                filters.push({
                    type: 'biomarker',
                    marker: definition.marker,
                    status: queryRule.status,
                    operator: queryRule.operator || '',
                    threshold: queryRule.threshold == null ? null : Number(queryRule.threshold)
                });
                remaining = remaining.replace(queryRule.regex, ' ');
                break;
            }
        }
        return { filters, remaining: remaining.replace(/\s+/g, ' ').trim() };
    }

    function genericClassify(trial, definition) {
        const mentions = [];
        const segments = base.splitTrialTextIntoSegments(trial || {});
        segments.forEach((segment) => {
            const detection = definition.detect ? definition.detect(segment.text, segment) : null;
            if (!detection) return;
            mentions.push({
                marker: definition.marker,
                status: detection.status || 'mentioned',
                statuses: detection.statuses || (detection.status ? [detection.status] : []),
                role: detection.role || segment.role,
                field: segment.field,
                evidence: segment.text,
                value: detection.value == null ? null : detection.value,
                ruleId: detection.ruleId || `${definition.marker}_MENTION`,
                confidence: detection.confidence == null ? 0.8 : detection.confidence
            });
        });
        const eligibleStatuses = unique(mentions
            .filter((item) => item.role === base.BIOMARKER_ROLE.ELIGIBILITY)
            .flatMap((item) => item.statuses || []));
        const excludedStatuses = unique(mentions
            .filter((item) => item.role === base.BIOMARKER_ROLE.EXCLUSION)
            .flatMap((item) => item.statuses || []));
        let summary = 'none';
        if (eligibleStatuses.length > 1) summary = 'mixed';
        else if (eligibleStatuses.length === 1) summary = eligibleStatuses[0];
        else if (mentions.length) summary = 'mentioned';
        return {
            marker: definition.marker,
            summary,
            eligibleStatuses,
            excludedStatuses,
            mentions,
            mentioned: mentions.length > 0
        };
    }

    function classifyBiomarker(trial, marker) {
        const definition = getBiomarkerDefinition(marker);
        if (!definition) return { marker: String(marker || ''), summary: 'none', eligibleStatuses: [], excludedStatuses: [], mentions: [], mentioned: false };
        return definition.classify ? definition.classify(trial, base) : genericClassify(trial, definition);
    }

    function genericMatches(classification, filter) {
        const eligible = classification.eligibleStatuses || [];
        const excluded = classification.excludedStatuses || [];
        if (filter.status === 'anyMention') return Boolean(classification.mentioned);
        if (filter.status === 'any') return eligible.includes('any');
        if (excluded.includes(filter.status) && !eligible.includes(filter.status)) return false;
        return eligible.includes(filter.status);
    }

    function matchesBiomarkerFilter(classification, filter) {
        const definition = getBiomarkerDefinition(filter && filter.marker);
        if (!definition) return false;
        return definition.matches
            ? definition.matches(classification, filter)
            : genericMatches(classification, filter);
    }

    function evaluateBiomarkerFilter(trial, filter) {
        const classification = classifyBiomarker(trial, filter.marker);
        return { matched: matchesBiomarkerFilter(classification, filter), classification };
    }

    return {
        registerBiomarker,
        getBiomarkerDefinition,
        listBiomarkerDefinitions,
        parseRegisteredBiomarkerQuery,
        classifyBiomarker,
        matchesBiomarkerFilter,
        evaluateBiomarkerFilter
    };
});