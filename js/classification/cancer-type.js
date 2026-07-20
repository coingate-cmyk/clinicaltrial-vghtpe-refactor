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

    const CANCER_RULES = [
        { id: 'CANCER_ESCC', value: '食道鱗狀細胞癌', priority: 130, patterns: [/\bESCC\b/i, /esophageal squamous/i, /食道.{0,8}鱗狀/i] },
        { id: 'CANCER_EAC', value: '食道腺癌', priority: 125, patterns: [/\bEAC\b/i, /esophageal adenocarcinoma/i, /食道.{0,8}腺癌/i] },
        { id: 'CANCER_GASTRIC_GEJ', value: '胃癌/胃食道交界腺癌', priority: 120, patterns: [/gastric (?:or |and )?(?:GEJ|gastro[- ]?esophageal junction)/i, /gastric cancer/i, /胃癌/i, /胃食道交界/i, /\bGEJ\b.{0,30}adenocarcinoma/i] },
        { id: 'CANCER_HCC', value: '肝細胞癌', priority: 120, patterns: [/\bHCC\b/i, /hepatocellular carcinoma/i, /肝細胞癌/i] },
        { id: 'CANCER_BTC', value: '膽道癌', priority: 120, patterns: [/\bBTC\b/i, /biliary tract cancer/i, /cholangiocarcinoma/i, /膽道癌/i, /膽管癌/i] },
        { id: 'CANCER_PANCREATIC', value: '胰臟癌', priority: 120, patterns: [/pancreatic (?:ductal )?adenocarcinoma/i, /\bPDAC\b/i, /胰臟癌/i, /胰腺癌/i] },
        { id: 'CANCER_CRC', value: '大腸直腸癌', priority: 120, patterns: [/\bCRC\b/i, /colorectal cancer/i, /colon (?:or |and )?rectal cancer/i, /大腸直腸癌/i, /結直腸癌/i, /大腸癌/i, /直腸癌/i] },
        { id: 'CANCER_GIST', value: '胃腸道基質瘤', priority: 120, patterns: [/\bGIST\b/i, /gastrointestinal stromal/i, /胃腸道基質瘤/i] },
        { id: 'CANCER_NET', value: '神經內分泌腫瘤', priority: 120, patterns: [/neuroendocrine tumou?r/i, /\bNET\b/i, /\bNEC\b/i, /神經內分泌/i] },
        { id: 'CANCER_SOLID_TUMOR', value: '泛實體腫瘤', priority: 20, patterns: [/advanced solid tumou?rs?/i, /multiple solid tumou?rs?/i, /實體腫瘤/i, /tumou?r[- ]agnostic/i, /basket study/i] }
    ];

    function classifyCancerTypes(trial) {
        const findings = engine.evaluateRules(trial, CANCER_RULES, { allowMultiple: true, minimumConfidence: 0.52 });
        const bestByValue = new Map();
        findings.forEach((finding) => {
            const previous = bestByValue.get(finding.value);
            if (!previous || finding.score > previous.score) bestByValue.set(finding.value, finding);
        });
        const results = Array.from(bestByValue.values()).sort((a, b) => b.priority - a.priority || b.score - a.score);
        const specific = results.filter((item) => item.value !== '泛實體腫瘤');
        return specific.length ? specific : results;
    }

    return { CANCER_RULES, classifyCancerTypes };
});