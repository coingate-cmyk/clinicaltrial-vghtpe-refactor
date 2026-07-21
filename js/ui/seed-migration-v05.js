(function (root) {
    'use strict';
    if (typeof localStorage === 'undefined') return;
    const app = root.ClinicalTrialApp;
    if (!app || !app.core || !app.parsing) return;
    const dataKey = 'clinicaltrial-vghtpe-refactor.trials.v2';
    const versionKey = 'clinicaltrial-vghtpe-refactor.seed-version';
    if (localStorage.getItem(versionKey) === '0.5') return;
    let records = [];
    try { records = JSON.parse(localStorage.getItem(dataKey) || '[]'); } catch (error) { records = []; }
    if (records.length) {
        const known = new Set(records.map((trial) => app.core.trialIdentityKey(trial)).filter(Boolean));
        (root.ClinicalTrialSyntheticData || []).forEach((rawTrial) => {
            const trial = app.parsing.prepareCandidate(rawTrial).trial;
            const key = app.core.trialIdentityKey(trial);
            if (key && !known.has(key)) {
                records.push(trial);
                known.add(key);
            }
        });
        localStorage.setItem(dataKey, JSON.stringify(records));
    }
    localStorage.setItem(versionKey, '0.5');
})(typeof globalThis !== 'undefined' ? globalThis : this);
