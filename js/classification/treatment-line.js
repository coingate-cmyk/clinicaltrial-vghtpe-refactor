(function (root, factory) {
    const engine = typeof module === 'object' && module.exports
        ? require('./rule-engine.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.classification) || {};
    const api = factory(engine);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.classification = Object.assign(root.ClinicalTrialApp.classification || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
    'use strict';

    const LINE_RULES = [
        { id: 'SETTING_NEOADJUVANT', value: 'neoadjuvant', priority: 150, patterns: [/neoadjuvant/i, /術前治療/i, /新輔助/i] },
        { id: 'SETTING_ADJUVANT', value: 'adjuvant', priority: 145, patterns: [/\badjuvant\b/i, /術後輔助/i, /輔助治療/i], negationPatterns: [/neoadjuvant/i] },
        { id: 'SETTING_PERIOPERATIVE', value: 'perioperative', priority: 140, patterns: [/perioperative/i, /圍手術期/i] },
        { id: 'LINE_FIRST', value: '1L', priority: 130, patterns: [/first[- ]line/i, /1st[- ]line/i, /\b1L\b/i, /第一線/i, /一線治療/i, /previously untreated/i, /treatment[- ]na[iï]ve/i] },
        { id: 'LINE_SECOND', value: '2L', priority: 125, patterns: [/second[- ]line/i, /2nd[- ]line/i, /\b2L\b/i, /第二線/i, /二線治療/i] },
        { id: 'LINE_THIRD', value: '3L', priority: 120, patterns: [/third[- ]line/i, /3rd[- ]line/i, /\b3L\b/i, /第三線/i, /三線治療/i] },
        { id: 'LINE_LATER', value: 'later-line', priority: 110, patterns: [/later[- ]line/i, /third[- ] or later/i, /2 or more prior/i, /at least two prior/i, /後線/i, /三線以上/i, /至少.{0,8}線/i] },
        { id: 'SETTING_LOCALLY_ADVANCED', value: 'locally-advanced', priority: 80, patterns: [/locally advanced/i, /局部晚期/i] },
        { id: 'SETTING_METASTATIC', value: 'metastatic', priority: 75, patterns: [/metastatic/i, /轉移性/i, /stage\s*iv/i, /第四期/i] },
        { id: 'SETTING_UNRESECTABLE', value: 'unresectable', priority: 70, patterns: [/unresectable/i, /不可切除/i] },
        { id: 'SETTING_REFRACTORY', value: 'refractory', priority: 65, patterns: [/refractory/i, /progressed after/i, /治療失敗/i, /復發或難治/i] }
    ];

    function classifyTreatmentLines(trial) {
        const findings = engine.evaluateRules(trial, LINE_RULES, { allowMultiple: true, minimumConfidence: 0.52 });
        const bestByValue = new Map();
        findings.forEach((finding) => {
            const previous = bestByValue.get(finding.value);
            if (!previous || finding.score > previous.score) bestByValue.set(finding.value, finding);
        });
        return Array.from(bestByValue.values()).sort((a, b) => b.priority - a.priority || b.score - a.score);
    }

    return { LINE_RULES, classifyTreatmentLines };
});