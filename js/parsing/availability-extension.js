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

    const OPERATIONAL_HEADERS = {
        lineId: ['line id', 'lineid', 'line account', 'line 帳號', 'line帳號'],
        enrolledCount: ['enrolled count', 'current enrollment', 'site enrolled', '已收案人數', '目前收案人數'],
        targetCount: ['target count', 'target enrollment', 'site target', '目標人數', '預計收案人數'],
        remainingSlots: ['remaining slots', 'slots remaining', '剩餘名額', '可用名額']
    };

    const normalizeHeader = (value) => normalization.normalizeInlineText(value)
        .toLowerCase()
        .replace(/[\s_\-/()（）:：.]+/g, '');

    const operationalLookup = Object.entries(OPERATIONAL_HEADERS).reduce((lookup, entry) => {
        entry[1].forEach((alias) => lookup.set(normalizeHeader(alias), entry[0]));
        return lookup;
    }, new Map());

    if (typeof parsing.mapHeaders === 'function' && !parsing.mapHeaders.__operational) {
        const originalMapHeaders = parsing.mapHeaders;
        const extendedMapHeaders = function (headers) {
            return originalMapHeaders(headers).map((mapping) => {
                if (mapping.field) return mapping;
                return Object.assign({}, mapping, { field: operationalLookup.get(normalizeHeader(mapping.original)) || '' });
            });
        };
        extendedMapHeaders.__operational = true;
        parsing.mapHeaders = extendedMapHeaders;
    }

    if (typeof parsing.parseTable === 'function' && typeof parsing.rowToRecord === 'function' && !parsing.parseTable.__operational) {
        const extendedParseTable = function (headers, rows, options) {
            const mapping = parsing.mapHeaders(headers);
            const records = (rows || [])
                .map((row) => parsing.rowToRecord(row, mapping, options))
                .filter((record) => Object.keys(record).length > 1);
            return {
                records,
                diagnostics: {
                    rowCount: (rows || []).length,
                    recordCount: records.length,
                    mappedHeaders: mapping.filter((item) => item.field),
                    unmappedHeaders: mapping.filter((item) => !item.field)
                }
            };
        };
        extendedParseTable.__operational = true;
        parsing.parseTable = extendedParseTable;
    }

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
    return { OPERATIONAL_HEADERS, attachAvailability, prepareCandidate };
});
