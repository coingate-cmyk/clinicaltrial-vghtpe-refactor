(function (root, factory) {
    const registry = typeof module === 'object' && module.exports
        ? require('./biomarker-registry.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.search) || {};
    const api = factory(registry);
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (registry) {
    'use strict';

    const normalize = (value) => String(value || '').normalize('NFKC').replace(/[–—−]/g, '-');

    registry.registerBiomarker({
        marker: 'MSI/MMR',
        queryRules: [
            { status: 'deficient', regex: /(?:(?:MSI\s*-?\s*H|MSI\s*high)(?:\s*(?:\/|or|或)\s*dMMR)?|dMMR(?:\s*(?:\/|or|或)\s*MSI\s*-?\s*H)?|MMR\s*deficient|錯配修復缺陷)/i },
            { status: 'proficient', regex: /(?:(?:MSS|MSI\s*-?\s*stable)(?:\s*(?:\/|or|或)\s*pMMR)?|pMMR(?:\s*(?:\/|or|或)\s*MSS)?|MMR\s*proficient|錯配修復正常)/i },
            { status: 'anyMention', regex: /(?:MSI|MMR|microsatellite)/i }
        ],
        detect(text) {
            const source = normalize(text);
            if (!/(?:MSI|MMR|microsatellite)/i.test(source)) return null;
            if (/(?:MSI\s*-?\s*H|MSI\s*high|microsatellite instability.{0,12}high|dMMR|MMR.{0,12}(?:deficient|deficiency)|錯配修復缺陷)/i.test(source)) {
                return { status: 'deficient', statuses: ['deficient'], ruleId: 'MSI_DMMR', confidence: 0.99 };
            }
            if (/(?:\bMSS\b|MSI\s*-?\s*stable|microsatellite stable|pMMR|MMR.{0,12}proficient|錯配修復正常)/i.test(source)) {
                return { status: 'proficient', statuses: ['proficient'], ruleId: 'MSS_PMMR', confidence: 0.99 };
            }
            return { status: 'mentioned', statuses: [], ruleId: 'MSI_MMR_MENTION', confidence: 0.55 };
        }
    });

    registry.registerBiomarker({
        marker: 'KRAS',
        queryRules: [
            { status: 'g12c', regex: /KRAS\s*G12C/i },
            { status: 'wild-type', regex: /KRAS\s*(?:WT|wild\s*-?\s*type|野生型)/i },
            { status: 'mutated', regex: /KRAS\s*(?:mutated|mutation|陽性|突變)/i },
            { status: 'anyMention', regex: /\bKRAS\b/i }
        ],
        detect(text) {
            const source = normalize(text);
            if (!/\bKRAS\b/i.test(source)) return null;
            if (/KRAS.{0,25}G12C|G12C.{0,25}KRAS/i.test(source)) return { status: 'g12c', statuses: ['g12c', 'mutated'], ruleId: 'KRAS_G12C', confidence: 0.99 };
            if (/KRAS.{0,25}(?:WT|wild\s*-?\s*type|野生型)/i.test(source)) return { status: 'wild-type', statuses: ['wild-type'], ruleId: 'KRAS_WT', confidence: 0.98 };
            if (/KRAS.{0,25}(?:mutated|mutation|陽性|突變)/i.test(source)) return { status: 'mutated', statuses: ['mutated'], ruleId: 'KRAS_MUTATED', confidence: 0.96 };
            return { status: 'mentioned', statuses: [], ruleId: 'KRAS_MENTION', confidence: 0.55 };
        }
    });

    registry.registerBiomarker({
        marker: 'BRAF',
        queryRules: [
            { status: 'v600e', regex: /BRAF\s*V600E/i },
            { status: 'wild-type', regex: /BRAF\s*(?:WT|wild\s*-?\s*type|野生型)/i },
            { status: 'mutated', regex: /BRAF\s*(?:mutated|mutation|陽性|突變)/i },
            { status: 'anyMention', regex: /\bBRAF\b/i }
        ],
        detect(text) {
            const source = normalize(text);
            if (!/\bBRAF\b/i.test(source)) return null;
            if (/BRAF.{0,25}V600E|V600E.{0,25}BRAF/i.test(source)) return { status: 'v600e', statuses: ['v600e', 'mutated'], ruleId: 'BRAF_V600E', confidence: 0.99 };
            if (/BRAF.{0,25}(?:WT|wild\s*-?\s*type|野生型)/i.test(source)) return { status: 'wild-type', statuses: ['wild-type'], ruleId: 'BRAF_WT', confidence: 0.98 };
            if (/BRAF.{0,25}(?:mutated|mutation|陽性|突變)/i.test(source)) return { status: 'mutated', statuses: ['mutated'], ruleId: 'BRAF_MUTATED', confidence: 0.96 };
            return { status: 'mentioned', statuses: [], ruleId: 'BRAF_MENTION', confidence: 0.55 };
        }
    });

    return { registered: ['MSI/MMR', 'KRAS', 'BRAF'] };
});