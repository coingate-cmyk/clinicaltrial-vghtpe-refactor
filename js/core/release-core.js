(function (root, factory) {
    const core = typeof module === 'object' && module.exports
        ? require('./normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const backup = typeof module === 'object' && module.exports
        ? require('./backup-service.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.backup) || {};
    const api = factory(core, backup);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.release = Object.assign(root.ClinicalTrialApp.release || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, backup) {
    'use strict';

    const APP_VERSION = '1.0.0';
    const TRIAL_KEY = 'clinicaltrial-vghtpe-refactor.trials.v2';
    const SNAPSHOT_KEY = 'clinicaltrial-vghtpe-refactor.snapshot.v1';
    const MANAGER_SESSION_KEY = 'clinicaltrial-vghtpe-refactor.manager.session.v1';

    function storageOrDefault(storage) {
        const value = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        if (!value) throw new Error('A Web Storage-compatible object is required.');
        return value;
    }

    function readJson(storage, key, fallback) {
        try {
            const text = storage.getItem(key);
            return text ? JSON.parse(text) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function readTrials(storage) {
        const store = storageOrDefault(storage);
        const value = readJson(store, TRIAL_KEY, []);
        return Array.isArray(value) ? value.map((trial) => core.normalizeTrial(trial)) : [];
    }

    function createSnapshot(storage, reason) {
        const store = storageOrDefault(storage);
        const envelope = backup.createBackupEnvelope(readTrials(store), { reason: reason || 'automatic snapshot', appVersion: APP_VERSION });
        store.setItem(SNAPSHOT_KEY, JSON.stringify(envelope));
        return envelope;
    }

    function writeTrials(trials, options) {
        const opts = Object.assign({ snapshot: true, snapshotReason: 'before local write' }, options || {});
        const store = storageOrDefault(opts.storage);
        if (opts.snapshot) createSnapshot(store, opts.snapshotReason);
        const normalized = backup.normalizeTrials(trials || []);
        store.setItem(TRIAL_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function readSnapshot(storage) {
        const store = storageOrDefault(storage);
        const value = readJson(store, SNAPSHOT_KEY, null);
        if (!value) return null;
        try { return backup.parseBackupEnvelope(value); } catch (error) { return null; }
    }

    function restoreSnapshot(storage) {
        const store = storageOrDefault(storage);
        const snapshot = readSnapshot(store);
        if (!snapshot) throw new Error('No valid local snapshot is available.');
        const current = backup.createBackupEnvelope(readTrials(store), { reason: 'before undo', appVersion: APP_VERSION });
        store.setItem(SNAPSHOT_KEY, JSON.stringify(current));
        store.setItem(TRIAL_KEY, JSON.stringify(snapshot.trials));
        return snapshot.trials;
    }

    function findTrialByIdentity(trials, identityKey, trialIdentityKey) {
        const list = Array.isArray(trials) ? trials : [];
        if (!identityKey || typeof trialIdentityKey !== 'function') return null;
        return list.find((trial) => trialIdentityKey(trial) === identityKey) || null;
    }

    function downloadJson(value, fileName) {
        if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
        const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        return true;
    }

    function setManagerSession(active, storage) {
        const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        if (!store) return false;
        if (active) store.setItem(MANAGER_SESSION_KEY, 'active');
        else store.removeItem(MANAGER_SESSION_KEY);
        return active;
    }

    function isManagerSessionActive(storage) {
        const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        return Boolean(store && store.getItem(MANAGER_SESSION_KEY) === 'active');
    }

    function formatValue(value) {
        if (value == null || value === '') return '';
        if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join('、');
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    }

    return {
        APP_VERSION,
        TRIAL_KEY,
        SNAPSHOT_KEY,
        MANAGER_SESSION_KEY,
        readTrials,
        writeTrials,
        createSnapshot,
        readSnapshot,
        restoreSnapshot,
        findTrialByIdentity,
        downloadJson,
        setManagerSession,
        isManagerSessionActive,
        formatValue
    };
});
