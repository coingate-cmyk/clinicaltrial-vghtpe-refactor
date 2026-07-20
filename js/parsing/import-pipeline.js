(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports ? require('../core/normalization.js') : root.ClinicalTrialApp.core;
    const schema = typeof module === 'object' && module.exports ? require('../core/trial-schema.js') : root.ClinicalTrialApp.core;
    const merge = typeof module === 'object' && module.exports ? require('../core/trial-merge.js') : root.ClinicalTrialApp.core;
    const classification = typeof module === 'object' && module.exports ? require('../classification/index.js') : root.ClinicalTrialApp.classification;
    const api = factory(normalization, schema, merge, classification);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization, schema, merge, classification) {
    'use strict';

    function applyClassifications(trial) {
        const classified = classification.classifyTrial(trial);
        const result = Object.assign({}, trial, { classifications: classified });
        if ((!result.cancerTypes || !result.cancerTypes.length) && classified.cancerTypes.length) {
            result.cancerTypes = classified.cancerTypes.map((finding) => ({ type: finding.value, lines: [] }));
        }
        if ((!result.treatmentLines || !result.treatmentLines.length) && classified.treatmentLines.length) {
            result.treatmentLines = classified.treatmentLines.map((finding) => finding.value);
        }
        if (result.status === 'unknown' && classified.enrollmentStatus.value !== 'unknown') result.status = classified.enrollmentStatus.value;
        return result;
    }

    function prepareCandidate(raw, options) {
        const normalized = normalization.normalizeTrial(raw, options);
        const classified = applyClassifications(normalized);
        const validation = schema.validateTrial(classified, options && options.validation);
        return { raw, trial: classified, identityKey: schema.trialIdentityKey(classified), validation };
    }

    function indexTrials(trials) {
        const index = new Map();
        (trials || []).forEach((trial, position) => {
            const normalized = applyClassifications(normalization.normalizeTrial(trial));
            const key = schema.trialIdentityKey(normalized);
            if (!key) return;
            if (!index.has(key)) index.set(key, []);
            index.get(key).push({ trial: normalized, position });
        });
        return index;
    }

    function planImport(rawRecords, existingTrials, options) {
        const candidates = (rawRecords || []).map((raw) => prepareCandidate(raw, options));
        const existingIndex = indexTrials(existingTrials);
        const incomingIndex = new Map();
        const actions = [];

        candidates.forEach((candidate, candidateIndex) => {
            if (!candidate.validation.valid) {
                actions.push({ type: 'invalid', candidateIndex, candidate, reasons: candidate.validation.errors });
                return;
            }
            if (!candidate.identityKey) {
                actions.push({ type: 'review', candidateIndex, candidate, reasons: [{ code: 'NO_IDENTITY', message: 'No stable identity could be created.' }] });
                return;
            }

            const duplicateIncoming = incomingIndex.get(candidate.identityKey);
            if (duplicateIncoming != null) {
                const first = candidates[duplicateIncoming];
                const combined = merge.mergeTrials(first.trial, candidate.trial, { preferIncoming: true });
                first.trial = combined.trial;
                first.validation = schema.validateTrial(first.trial, options && options.validation);
                actions.push({ type: 'duplicate_in_file', candidateIndex, duplicateOf: duplicateIncoming, candidate, conflicts: combined.conflicts });
                return;
            }
            incomingIndex.set(candidate.identityKey, candidateIndex);

            const matches = existingIndex.get(candidate.identityKey) || [];
            if (matches.length > 1) {
                actions.push({ type: 'review', candidateIndex, candidate, reasons: [{ code: 'MULTIPLE_EXISTING_MATCHES', message: 'Multiple existing trials share the same identity.' }], matches });
                return;
            }
            if (matches.length === 0) {
                actions.push({ type: 'add', candidateIndex, candidate, proposed: candidate.trial });
                return;
            }

            const existing = matches[0];
            const comparison = merge.compareTrials(existing.trial, candidate.trial);
            if (!comparison.changed) actions.push({ type: 'unchanged', candidateIndex, candidate, existing });
            else if (comparison.conflicts.length) actions.push({ type: 'review', candidateIndex, candidate, existing, proposed: comparison.merged, conflicts: comparison.conflicts });
            else actions.push({ type: 'update', candidateIndex, candidate, existing, proposed: comparison.merged });
        });

        const summary = actions.reduce((counts, action) => {
            counts[action.type] = (counts[action.type] || 0) + 1;
            return counts;
        }, { total: actions.length, add: 0, update: 0, unchanged: 0, review: 0, invalid: 0, duplicate_in_file: 0 });

        return { candidates, actions, summary };
    }

    function applyImportPlan(existingTrials, plan, selections) {
        const result = (existingTrials || []).map((trial) => normalization.normalizeTrial(trial));
        const selected = selections || {};
        (plan && plan.actions || []).forEach((action, actionIndex) => {
            const decision = selected[actionIndex] || (['add', 'update'].includes(action.type) ? 'accept' : 'skip');
            if (decision !== 'accept') return;
            if (action.type === 'add') result.push(action.proposed);
            if (action.type === 'update' && action.existing) result[action.existing.position] = action.proposed;
            if (action.type === 'review' && action.proposed && action.existing) result[action.existing.position] = action.proposed;
        });
        return result;
    }

    function createParserRegistry() {
        const parsers = new Map();
        return {
            register(name, parser) {
                if (!name || typeof parser !== 'function') throw new TypeError('Parser name and function are required.');
                parsers.set(name, parser);
                return this;
            },
            has(name) { return parsers.has(name); },
            parse(name, input, options) {
                if (!parsers.has(name)) throw new Error(`Unknown parser: ${name}`);
                return parsers.get(name)(input, options || {});
            },
            names() { return Array.from(parsers.keys()); }
        };
    }

    return { applyClassifications, prepareCandidate, indexTrials, planImport, applyImportPlan, createParserRegistry };
});