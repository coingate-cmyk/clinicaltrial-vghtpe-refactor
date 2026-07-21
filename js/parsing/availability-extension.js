(function (root, factory) {
    const parsing = typeof module === 'object' && module.exports
        ? require('./import-pipeline.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.parsing) || {};
    const slots = typeof module === 'object' && module.exports
        ? require('../classification/slot-availability.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.classification) || {};
    const normalization = typeof module === 'object' && module.exports
        ? require('../core/normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(parsing, slots, normalization);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (parsing, slots, normalization) {
    'use strict';

    function attachAvailability(trial, raw) {
        const source = raw || trial || {};
        const finding = slots.classifySlotAvailability(trial, source);
        const classifications = Object.assign({}, trial.classifications || {}, { slotAvailability: finding });
        const contacts = Object.assign({}, trial.contacts || {});
        const rawContacts = source.contacts || {};
        const lineId = normalization.normalizeInlineText(source.lineId || source.lineID || rawContacts.lineId || rawContacts.lineID || '');
        if (lineId) contacts.lineId = lineId;
        return Object.assign({}, trial, {
            availability: finding.value,
            availabilityRaw: trial.availabilityRaw || finding.raw || '',
            contacts,
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
