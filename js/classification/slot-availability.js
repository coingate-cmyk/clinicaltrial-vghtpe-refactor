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

    const AVAILABILITY_VALUES = Object.freeze(['available', 'limited', 'full', 'paused', 'closed', 'pending', 'unknown']);

    function explicitSources(item) {
        return [
            ['availabilityRaw', item && item.availabilityRaw],
            ['availability', item && item.availability],
            ['slotStatus', item && item.slotStatus],
            ['slotAvailability', item && item.slotAvailability],
            ['capacityStatus', item && item.capacityStatus],
            ['localAvailability', item && item.localAvailability],
            ['localStatus', item && item.localStatus]
        ];
    }

    function classifySlotAvailability(trial, raw) {
        const normalizedTrial = trial || {};
        const sourceObject = raw || normalizedTrial;
        for (const [field, value] of explicitSources(sourceObject)) {
            const normalized = normalization.normalizeAvailability(value);
            if (normalized !== 'unknown') {
                return {
                    value: normalized,
                    raw: normalization.normalizeInlineText(value),
                    confidence: 0.99,
                    evidence: [{ field, excerpt: normalization.normalizeInlineText(value) }]
                };
            }
        }

        const textSources = [
            ['notes', sourceObject.notes || normalizedTrial.notes],
            ['summary', sourceObject.summary || normalizedTrial.summary],
            ['statusRaw', sourceObject.statusRaw || normalizedTrial.statusRaw]
        ];
        for (const [field, value] of textSources) {
            const normalized = normalization.normalizeAvailability(value);
            if (normalized !== 'unknown') {
                return {
                    value: normalized,
                    raw: normalization.normalizeInlineText(value),
                    confidence: field === 'statusRaw' ? 0.85 : 0.75,
                    evidence: [{ field, excerpt: normalization.normalizeInlineText(value) }]
                };
            }
        }

        const status = normalizedTrial.status;
        if (status === 'recruiting') return { value: 'available', raw: normalizedTrial.statusRaw || 'recruiting', confidence: 0.6, evidence: [{ field: 'status', excerpt: 'recruiting' }] };
        if (status === 'pending') return { value: 'pending', raw: normalizedTrial.statusRaw || 'pending', confidence: 0.8, evidence: [{ field: 'status', excerpt: 'pending' }] };
        if (status === 'temporarily_closed') return { value: 'paused', raw: normalizedTrial.statusRaw || 'temporarily closed', confidence: 0.9, evidence: [{ field: 'status', excerpt: 'temporarily_closed' }] };
        if (status === 'closed') return { value: 'closed', raw: normalizedTrial.statusRaw || 'closed', confidence: 0.95, evidence: [{ field: 'status', excerpt: 'closed' }] };
        if (normalizedTrial.active === true) return { value: 'available', raw: 'active=true', confidence: 0.55, evidence: [{ field: 'active', excerpt: 'true' }] };
        if (normalizedTrial.active === false) return { value: 'closed', raw: 'active=false', confidence: 0.55, evidence: [{ field: 'active', excerpt: 'false' }] };
        return { value: 'unknown', raw: '', confidence: 0.2, evidence: [] };
    }

    function isOpenForEnrollment(value) {
        return ['available', 'limited', 'pending'].includes(String(value || 'unknown'));
    }

    return { AVAILABILITY_VALUES, classifySlotAvailability, isOpenForEnrollment };
});