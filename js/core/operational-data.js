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

    const PROTECTED_FIELDS = new Set([
        'contacts.pi', 'contacts.nurse', 'contacts.phone', 'contacts.email',
        'availability', 'status',
        'siteEnrollment.enrolledCount', 'siteEnrollment.targetCount', 'siteEnrollment.remainingSlots'
    ]);

    const CONTACT_FIELDS = new Set(['contacts.pi', 'contacts.nurse', 'contacts.phone', 'contacts.email']);
    const COUNT_FIELDS = new Set(['siteEnrollment.enrolledCount', 'siteEnrollment.targetCount', 'siteEnrollment.remainingSlots']);

    function isProtectedField(path) {
        return PROTECTED_FIELDS.has(String(path || ''));
    }

    function fieldCategory(path) {
        const key = String(path || '');
        if (CONTACT_FIELDS.has(key)) return 'contact';
        if (COUNT_FIELDS.has(key)) return 'enrollment-count';
        if (key === 'availability' || key === 'status') return 'operational-status';
        return 'content';
    }

    function parseTime(value) {
        const time = Date.parse(value || '');
        return Number.isFinite(time) ? time : 0;
    }

    function metadataForPath(trial, path) {
        const item = trial || {};
        const direct = item.fieldMeta && item.fieldMeta[path] || {};
        if (String(path).startsWith('contacts.')) {
            const contacts = item.contacts || {};
            return {
                verifiedAt: direct.verifiedAt || contacts.verifiedAt || '',
                verifiedBy: direct.verifiedBy || contacts.verifiedBy || '',
                sourceName: direct.sourceName || contacts.sourceName || (item.source && item.source.name) || '',
                sourceDate: direct.sourceDate || contacts.verifiedAt || (item.source && item.source.importedAt) || ''
            };
        }
        if (String(path).startsWith('siteEnrollment.') || path === 'availability') {
            const enrollment = item.siteEnrollment || {};
            return {
                verifiedAt: direct.verifiedAt || enrollment.lastVerifiedAt || '',
                verifiedBy: direct.verifiedBy || enrollment.verifiedBy || '',
                sourceName: direct.sourceName || enrollment.sourceName || (item.source && item.source.name) || '',
                sourceDate: direct.sourceDate || enrollment.lastVerifiedAt || (item.source && item.source.importedAt) || ''
            };
        }
        return {
            verifiedAt: direct.verifiedAt || '',
            verifiedBy: direct.verifiedBy || '',
            sourceName: direct.sourceName || (item.source && item.source.name) || '',
            sourceDate: direct.sourceDate || (item.source && item.source.importedAt) || ''
        };
    }

    function recommendConflict(path, existingTrial, incomingTrial) {
        const existingMeta = metadataForPath(existingTrial, path);
        const incomingMeta = metadataForPath(incomingTrial, path);
        const existingVerified = parseTime(existingMeta.verifiedAt);
        const incomingVerified = parseTime(incomingMeta.verifiedAt);
        if (incomingVerified && incomingVerified > existingVerified) return { choice: 'incoming', reason: 'incoming-newer-verified' };
        if (existingVerified && existingVerified >= incomingVerified) return { choice: 'existing', reason: 'existing-verified' };
        const existingDate = parseTime(existingMeta.sourceDate);
        const incomingDate = parseTime(incomingMeta.sourceDate);
        if (incomingDate && incomingDate > existingDate) return { choice: 'incoming', reason: 'incoming-newer-source' };
        return { choice: 'existing', reason: 'preserve-existing-until-reviewed' };
    }

    function validateOperationalReadiness(trial) {
        const item = trial || {};
        const contacts = item.contacts || {};
        const availability = item.availability || 'unknown';
        const requiresContact = ['available', 'limited', 'pending'].includes(availability);
        const errors = [];
        const warnings = [];
        if (requiresContact && !normalization.normalizeInlineText(contacts.nurse)) {
            errors.push({ field: 'contacts.nurse', code: 'NURSE_REQUIRED', message: '可收案或準備中的試驗必須填寫研究護理師姓名。' });
        }
        if (requiresContact && !normalization.normalizeInlineText(contacts.phone) && !normalization.normalizeInlineText(contacts.email)) {
            errors.push({ field: 'contacts', code: 'CONTACT_METHOD_REQUIRED', message: '可收案或準備中的試驗至少需要電話或 Email。' });
        }
        if (!normalization.normalizeInlineText(contacts.pi)) warnings.push({ field: 'contacts.pi', code: 'PI_MISSING', message: '尚未填寫 PI。' });
        if (!normalization.normalizeInlineText(contacts.verifiedAt)) warnings.push({ field: 'contacts.verifiedAt', code: 'CONTACT_UNVERIFIED', message: '聯絡資訊尚未記錄驗證日期。' });
        return { valid: errors.length === 0, errors, warnings };
    }

    function appendChangeLog(trial, entry) {
        const log = Array.isArray(trial && trial.changeLog) ? trial.changeLog.slice() : [];
        log.push(Object.assign({ changedAt: new Date().toISOString() }, entry || {}));
        return log;
    }

    return {
        PROTECTED_FIELDS,
        isProtectedField,
        fieldCategory,
        metadataForPath,
        recommendConflict,
        validateOperationalReadiness,
        appendChangeLog
    };
});
