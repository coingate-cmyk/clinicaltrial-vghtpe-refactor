(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports ? require('../core/normalization.js') : root.ClinicalTrialApp.core;
    const schema = typeof module === 'object' && module.exports ? require('../core/trial-schema.js') : root.ClinicalTrialApp.core;
    const api = factory(normalization, schema);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.repositories = Object.assign(root.ClinicalTrialApp.repositories || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization, schema) {
    'use strict';

    function createMemoryRepository(initialTrials) {
        let trials = (initialTrials || []).map((trial) => normalization.normalizeTrial(trial));
        const listeners = new Set();
        function clone(value) { return JSON.parse(JSON.stringify(value)); }
        function emit() {
            const snapshot = clone(trials);
            listeners.forEach((listener) => listener(snapshot));
        }
        return {
            async list() { return clone(trials); },
            async get(identity) {
                const key = typeof identity === 'string' && identity.includes(':') ? identity : schema.trialIdentityKey(normalization.normalizeTrial({ code: identity }));
                const trial = trials.find((item) => schema.trialIdentityKey(item) === key);
                return trial ? clone(trial) : null;
            },
            async save(trial) {
                const normalized = normalization.normalizeTrial(trial);
                schema.assertValidTrial(normalized);
                const key = schema.trialIdentityKey(normalized);
                if (!key) throw new Error('Cannot save a trial without an identity.');
                const index = trials.findIndex((item) => schema.trialIdentityKey(item) === key);
                if (index >= 0) trials[index] = normalized;
                else trials.push(normalized);
                emit();
                return clone(normalized);
            },
            async remove(identity) {
                const key = typeof identity === 'string' && identity.includes(':') ? identity : schema.trialIdentityKey(normalization.normalizeTrial({ code: identity }));
                const before = trials.length;
                trials = trials.filter((item) => schema.trialIdentityKey(item) !== key);
                if (trials.length !== before) emit();
                return trials.length !== before;
            },
            async replaceAll(nextTrials) {
                trials = (nextTrials || []).map((trial) => normalization.normalizeTrial(trial));
                emit();
                return this.list();
            },
            subscribe(listener) {
                if (typeof listener !== 'function') throw new TypeError('listener must be a function');
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        };
    }

    return { createMemoryRepository };
});