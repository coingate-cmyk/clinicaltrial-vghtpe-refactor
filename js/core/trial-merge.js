(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports
        ? require('./normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const schema = typeof module === 'object' && module.exports
        ? require('./trial-schema.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const operational = typeof module === 'object' && module.exports
        ? require('./operational-data.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(normalization, schema, operational);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.core = Object.assign(root.ClinicalTrialApp.core || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization, schema, operational) {
    'use strict';

    const EMPTY_VALUES = new Set(['', null, undefined]);

    function isEmpty(value) {
        if (EMPTY_VALUES.has(value)) return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return value && Object.keys(value).length === 0;
        return false;
    }

    function deepEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function mergeUniqueList(left, right, keyFn) {
        const result = [];
        const seen = new Set();
        [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].forEach((item) => {
            const key = keyFn ? keyFn(item) : JSON.stringify(item);
            if (!key || seen.has(key)) return;
            seen.add(key);
            result.push(item);
        });
        return result;
    }

    function mergeCancerTypes(existing, incoming) {
        const map = new Map();
        [...(existing || []), ...(incoming || [])].forEach((entry) => {
            if (!entry || !entry.type) return;
            const key = normalization.normalizeCancerLabel(entry.type).toLowerCase();
            const previous = map.get(key) || { type: normalization.normalizeCancerLabel(entry.type), lines: [] };
            previous.lines = mergeUniqueList(previous.lines, entry.lines || [], (line) => normalization.normalizeInlineText(line).toLowerCase());
            map.set(key, previous);
        });
        return Array.from(map.values());
    }

    function chosenResolution(options, fieldPath) {
        const resolutions = options && options.resolutions || {};
        const value = resolutions[fieldPath];
        return value === 'incoming' || value === 'existing' ? value : '';
    }

    function mergeObject(existing, incoming, path, context) {
        const left = existing && typeof existing === 'object' ? existing : {};
        const right = incoming && typeof incoming === 'object' ? incoming : {};
        const result = Object.assign({}, left);
        const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
        keys.forEach((key) => {
            if (path === '' && ['changeLog', 'fieldMeta'].includes(key)) return;
            const fieldPath = path ? `${path}.${key}` : key;
            const a = left[key];
            const b = right[key];
            if (isEmpty(b)) return;
            if (isEmpty(a)) { result[key] = b; return; }
            if (deepEqual(a, b)) return;
            if (Array.isArray(a) || Array.isArray(b)) { result[key] = mergeUniqueList(a, b); return; }
            if (typeof a === 'object' && typeof b === 'object') {
                result[key] = mergeObject(a, b, fieldPath, context);
                return;
            }

            const protectedField = operational.isProtectedField && operational.isProtectedField(fieldPath);
            const recommendation = operational.recommendConflict
                ? operational.recommendConflict(fieldPath, context.leftRoot, context.rightRoot)
                : { choice: 'existing', reason: 'preserve-existing-until-reviewed' };
            const resolution = chosenResolution(context.options, fieldPath);
            const conflict = {
                field: fieldPath,
                existing: a,
                incoming: b,
                protected: Boolean(protectedField),
                category: operational.fieldCategory ? operational.fieldCategory(fieldPath) : 'content',
                existingMeta: operational.metadataForPath ? operational.metadataForPath(context.leftRoot, fieldPath) : {},
                incomingMeta: operational.metadataForPath ? operational.metadataForPath(context.rightRoot, fieldPath) : {},
                recommendedChoice: recommendation.choice,
                recommendationReason: recommendation.reason,
                resolution: resolution || ''
            };
            context.conflicts.push(conflict);

            let choice = resolution;
            if (!choice && !protectedField) {
                if (((context.options && context.options.preferIncomingFields) || []).includes(fieldPath) || (context.options && context.options.preferIncoming === true)) choice = 'incoming';
            }
            if (choice === 'incoming') {
                result[key] = b;
                context.selectedIncoming.push({ field: fieldPath, existing: a, incoming: b, conflict });
            }
        });
        return result;
    }

    function mergeTrials(existing, incoming, options) {
        const left = normalization.normalizeTrial(existing || {});
        const right = normalization.normalizeTrial(incoming || {});
        const leftKey = schema.trialIdentityKey(left);
        const rightKey = schema.trialIdentityKey(right);
        if (leftKey && rightKey && leftKey !== rightKey) {
            const error = new Error(`Cannot merge different trials: ${leftKey} vs ${rightKey}`);
            error.code = 'IDENTITY_MISMATCH';
            throw error;
        }

        const context = { leftRoot: left, rightRoot: right, conflicts: [], selectedIncoming: [], options: options || {} };
        const merged = mergeObject(left, right, '', context);
        merged.cancerTypes = mergeCancerTypes(left.cancerTypes, right.cancerTypes);
        merged.treatmentLines = mergeUniqueList(left.treatmentLines, right.treatmentLines, (line) => normalization.normalizeInlineText(line).toLowerCase());
        merged.interventions = mergeUniqueList(left.interventions, right.interventions, (item) => normalization.normalizeInlineText(item).toLowerCase());
        merged.sites = mergeUniqueList(left.sites, right.sites, (item) => normalization.normalizeInlineText(item).toLowerCase());
        merged.biomarkers = mergeUniqueList(left.biomarkers, right.biomarkers, (item) => JSON.stringify(item));
        merged.provenance = mergeUniqueList(left.provenance, right.provenance, (item) => JSON.stringify(item));
        merged.fieldMeta = Object.assign({}, left.fieldMeta || {});
        context.selectedIncoming.forEach((selection) => {
            const incomingMeta = right.fieldMeta && right.fieldMeta[selection.field];
            if (incomingMeta) merged.fieldMeta[selection.field] = incomingMeta;
            else if (operational.metadataForPath) merged.fieldMeta[selection.field] = operational.metadataForPath(right, selection.field);
        });
        merged.changeLog = mergeUniqueList(left.changeLog, right.changeLog, (item) => JSON.stringify(item));
        context.selectedIncoming.filter((selection) => selection.conflict.protected).forEach((selection) => {
            merged.changeLog = operational.appendChangeLog ? operational.appendChangeLog(merged, {
                field: selection.field,
                oldValue: selection.existing,
                newValue: selection.incoming,
                changedBy: normalization.normalizeInlineText(options && options.actor),
                reason: 'import-conflict-resolution',
                sourceName: selection.conflict.incomingMeta && selection.conflict.incomingMeta.sourceName || ''
            }) : merged.changeLog;
        });
        merged.id = left.id || right.id;
        merged.schemaVersion = schema.SCHEMA_VERSION;

        return {
            trial: merged,
            conflicts: context.conflicts,
            unresolvedConflicts: context.conflicts.filter((conflict) => !conflict.resolution),
            selectedIncoming: context.selectedIncoming,
            changed: !deepEqual(left, merged)
        };
    }

    function compareTrials(existing, incoming) {
        const merged = mergeTrials(existing, incoming, { preferIncoming: false });
        return { changed: merged.changed, conflicts: merged.conflicts, unresolvedConflicts: merged.unresolvedConflicts, merged: merged.trial };
    }

    return { isEmpty, deepEqual, mergeUniqueList, mergeCancerTypes, mergeTrials, compareTrials };
});
