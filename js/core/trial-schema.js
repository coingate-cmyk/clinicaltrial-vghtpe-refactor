(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports
        ? require('./normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(normalization);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.core = Object.assign(root.ClinicalTrialApp.core || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization) {
    'use strict';

    const SCHEMA_VERSION = 1;
    const VALID_STATUSES = new Set(['recruiting', 'temporarily_closed', 'closed', 'pending', 'unknown']);
    const VALID_AVAILABILITIES = new Set(['available', 'limited', 'full', 'paused', 'closed', 'pending', 'unknown']);

    function createEmptyTrial(overrides) {
        return Object.assign(normalization.normalizeTrial({}), overrides || {}, { schemaVersion: SCHEMA_VERSION });
    }

    function trialIdentityKey(trial) {
        const item = trial || {};
        const code = normalization.compactCode(item.code);
        if (code) return `code:${code}`;
        const sourceId = normalization.normalizeInlineText(item.source && item.source.sourceId).toLowerCase();
        if (sourceId) return `source:${sourceId}`;
        const title = normalization.normalizeInlineText(item.title).toLowerCase();
        const sponsor = normalization.normalizeInlineText(item.sponsor).toLowerCase();
        if (title) return `title:${title}|sponsor:${sponsor}`;
        return '';
    }

    function validateTrial(trial, options) {
        const item = trial || {};
        const opts = options || {};
        const errors = [];
        const warnings = [];

        if (item.schemaVersion !== SCHEMA_VERSION) errors.push({ field: 'schemaVersion', code: 'UNSUPPORTED_SCHEMA', message: `Expected schemaVersion ${SCHEMA_VERSION}` });
        if (!normalization.normalizeInlineText(item.code)) warnings.push({ field: 'code', code: 'MISSING_CODE', message: 'Study code is missing; deduplication may be unreliable.' });
        if (!normalization.normalizeInlineText(item.title)) warnings.push({ field: 'title', code: 'MISSING_TITLE', message: 'Study title is missing.' });
        if (!Array.isArray(item.cancerTypes) || item.cancerTypes.length === 0) warnings.push({ field: 'cancerTypes', code: 'MISSING_CANCER_TYPE', message: 'Cancer type was not identified.' });
        if (!VALID_STATUSES.has(item.status)) errors.push({ field: 'status', code: 'INVALID_STATUS', message: `Unknown normalized status: ${item.status}` });
        if (!VALID_AVAILABILITIES.has(item.availability || 'unknown')) errors.push({ field: 'availability', code: 'INVALID_AVAILABILITY', message: `Unknown availability: ${item.availability}` });
        if (item.contacts && typeof item.contacts !== 'object') errors.push({ field: 'contacts', code: 'INVALID_CONTACTS', message: 'contacts must be an object.' });
        if (item.provenance && !Array.isArray(item.provenance)) errors.push({ field: 'provenance', code: 'INVALID_PROVENANCE', message: 'provenance must be an array.' });
        if (opts.requireCode && !item.code) errors.push({ field: 'code', code: 'CODE_REQUIRED', message: 'A study code is required for this import.' });

        return { valid: errors.length === 0, errors, warnings };
    }

    function assertValidTrial(trial, options) {
        const result = validateTrial(trial, options);
        if (!result.valid) {
            const error = new Error(result.errors.map((item) => item.message).join('; '));
            error.validation = result;
            throw error;
        }
        return trial;
    }

    return { SCHEMA_VERSION, VALID_STATUSES, VALID_AVAILABILITIES, createEmptyTrial, trialIdentityKey, validateTrial, assertValidTrial };
});
