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

    function classifyEnrollmentStatus(trial) {
        const item = trial || {};
        const sources = [
            ['statusRaw', item.statusRaw],
            ['status', item.status],
            ['notes', item.notes],
            ['summary', item.summary]
        ];
        for (const source of sources) {
            const value = normalization.normalizeEnrollmentStatus(source[1]);
            if (value !== 'unknown') {
                return {
                    value,
                    confidence: source[0] === 'statusRaw' || source[0] === 'status' ? 0.99 : 0.75,
                    evidence: [{ field: source[0], excerpt: normalization.normalizeInlineText(source[1]) }]
                };
            }
        }
        return { value: 'unknown', confidence: 0.2, evidence: [] };
    }

    return { classifyEnrollmentStatus };
});