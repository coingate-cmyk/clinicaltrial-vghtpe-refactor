(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports
        ? require('./normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(normalization);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.backup = Object.assign(root.ClinicalTrialApp.backup || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization) {
    'use strict';

    const BACKUP_SCHEMA = 'clinicaltrial-vghtpe-backup/v1';
    const APP_VERSION = '1.0.0';

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeTrials(trials) {
        if (!Array.isArray(trials)) throw new TypeError('trials must be an array');
        return trials.map((trial) => normalization.normalizeTrial(trial));
    }

    function createBackupEnvelope(trials, options) {
        const opts = Object.assign({ reason: 'manual backup', exportedAt: new Date().toISOString(), appVersion: APP_VERSION }, options || {});
        const normalized = normalizeTrials(trials || []);
        return {
            schema: BACKUP_SCHEMA,
            appVersion: String(opts.appVersion || APP_VERSION),
            exportedAt: String(opts.exportedAt || new Date().toISOString()),
            reason: String(opts.reason || 'manual backup'),
            trialCount: normalized.length,
            trials: clone(normalized)
        };
    }

    function parseBackupEnvelope(value) {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(parsed)) {
            const trials = normalizeTrials(parsed);
            return { schema: 'legacy-array', appVersion: '', exportedAt: '', reason: 'legacy import', trialCount: trials.length, trials };
        }
        if (!parsed || typeof parsed !== 'object') throw new TypeError('Backup must be a JSON object or array.');
        if (!Array.isArray(parsed.trials)) throw new TypeError('Backup object must contain a trials array.');
        const trials = normalizeTrials(parsed.trials);
        const declaredCount = parsed.trialCount == null ? trials.length : Number(parsed.trialCount);
        if (!Number.isFinite(declaredCount) || declaredCount !== trials.length) {
            throw new Error(`Backup trialCount mismatch: declared ${parsed.trialCount}, actual ${trials.length}.`);
        }
        return {
            schema: String(parsed.schema || 'legacy-object'),
            appVersion: String(parsed.appVersion || ''),
            exportedAt: String(parsed.exportedAt || ''),
            reason: String(parsed.reason || 'import'),
            trialCount: trials.length,
            trials
        };
    }

    function validateBackupEnvelope(value, options) {
        const opts = Object.assign({ requireCode: false, maximumTrials: 5000 }, options || {});
        const envelope = parseBackupEnvelope(value);
        if (envelope.trials.length > opts.maximumTrials) {
            throw new Error(`Backup contains ${envelope.trials.length} trials; maximum allowed is ${opts.maximumTrials}.`);
        }
        const duplicateKeys = [];
        const seen = new Set();
        envelope.trials.forEach((trial, index) => {
            const code = normalization.normalizeCode(trial.code);
            if (opts.requireCode && !code) throw new Error(`Trial at index ${index} has no study code.`);
            const key = code ? code.replace(/[^A-Z0-9]/g, '') : String(trial.id || '').toLowerCase();
            if (!key) return;
            if (seen.has(key)) duplicateKeys.push(key);
            seen.add(key);
        });
        return { valid: duplicateKeys.length === 0, duplicateKeys, envelope };
    }

    function backupFileName(dateValue) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
        const stamp = Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
        return `clinical-trials-backup-${stamp}.json`;
    }

    return {
        BACKUP_SCHEMA,
        APP_VERSION,
        normalizeTrials,
        createBackupEnvelope,
        parseBackupEnvelope,
        validateBackupEnvelope,
        backupFileName
    };
});
