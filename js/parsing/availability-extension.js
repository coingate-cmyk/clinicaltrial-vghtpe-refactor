(function (root, factory) {
    const parsing = typeof module === 'object' && module.exports
        ? require('./import-pipeline.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.parsing) || {};
    const slots = typeof module === 'object' && module.exports
        ? require('../classification/slot-availability.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.classification) || {};
    const api = factory(parsing, slots);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (parsing, slots) {
    'use strict';

    function attachAvailability(trial, raw) {
        const finding = slots.classifySlotAvailability(trial, raw || trial);
        const classifications = Object.assign({}, trial.classifications || {}, { slotAvailability: finding });
        return Object.assign({}, trial, {
            availability: finding.value,
            availabilityRaw: trial.availabilityRaw || finding.raw || '',
            classifications
        });
    }

    const originalPrepareCandidate = parsing.prepareCandidate;
    function prepareCandidate(raw, options) {
        const candidate = originalPrepareCandidate(raw, options);
        candidate.trial = attachAvailability(candidate.trial, raw);
        return candidate;
    }

    parsing.prepareCandidate = prepareCandidate;
    return { attachAvailability, prepareCandidate };
});
