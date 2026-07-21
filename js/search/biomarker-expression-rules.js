(function (root, factory) {
    const registry = typeof module === 'object' && module.exports
        ? require('./biomarker-registry.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.search) || {};
    const api = factory(registry);
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (registry) {
    'use strict';

    const normalized = (value) => String(value || '').normalize('NFKC').replace(/[–—−]/g, '-');
    const test = (regex, value) => new RegExp(regex.source, regex.flags.replace(/g/g, '')).test(normalized(value));

    function expressionDetection(marker, mention, positive, negative, text) {
        const source = normalized(text);
        if (!test(mention, source)) return null;
        if (/regardless.{0,25}(?:status|expression)|status.{0,25}not required|不限|無須/i.test(source)) {
            return { status: 'any', statuses: ['any'], ruleId: `${marker}_ANY`, confidence: 0.96 };
        }
        if (test(negative, source)) return { status: 'negative', statuses: ['negative'], ruleId: `${marker}_NEGATIVE`, confidence: 0.98 };
        if (test(positive, source)) return { status: 'positive', statuses: ['positive'], ruleId: `${marker}_POSITIVE`, confidence: 0.98 };
        return { status: 'mentioned', statuses: [], ruleId: `${marker}_MENTION`, confidence: 0.55 };
    }

    registry.registerBiomarker({
        marker: 'CLDN18.2',
        queryRules: [
            { status: 'positive', regex: /(?:CLDN\s*18(?:\.?2)?|CLAUDIN\s*18(?:\.?2)?)\s*(?:\+|positive|陽性)/i },
            { status: 'negative', regex: /(?:CLDN\s*18(?:\.?2)?|CLAUDIN\s*18(?:\.?2)?)\s*(?:-|negative|陰性)/i },
            { status: 'anyMention', regex: /(?:CLDN\s*18(?:\.?2)?|CLAUDIN\s*18(?:\.?2)?)/i }
        ],
        detect(text) {
            return expressionDetection(
                'CLDN18.2',
                /CLDN\s*18(?:\.?2)?|CLAUDIN\s*18(?:\.?2)?/i,
                /(?:CLDN\s*18(?:\.?2)?|CLAUDIN\s*18(?:\.?2)?).{0,45}(?:\+|positive|陽性|(?:>=|≥)\s*\d+\s*%|2\+|3\+)/i,
                /(?:CLDN\s*18(?:\.?2)?|CLAUDIN\s*18(?:\.?2)?).{0,30}(?:negative|陰性|\(\s*-\s*\))/i,
                text
            );
        }
    });

    registry.registerBiomarker({
        marker: 'FGFR2B',
        queryRules: [
            { status: 'positive', regex: /FGFR\s*2\s*B\s*(?:\+|positive|陽性)/i },
            { status: 'negative', regex: /FGFR\s*2\s*B\s*(?:-|negative|陰性)/i },
            { status: 'anyMention', regex: /FGFR\s*2\s*B/i }
        ],
        detect(text) {
            return expressionDetection(
                'FGFR2B',
                /FGFR\s*2\s*B/i,
                /FGFR\s*2\s*B.{0,35}(?:\+|positive|陽性|overexpression|高表現|2\+|3\+)/i,
                /FGFR\s*2\s*B.{0,25}(?:negative|陰性|\(\s*-\s*\))/i,
                text
            );
        }
    });

    registry.registerBiomarker({
        marker: 'PD-L1',
        queryRules: [
            {
                status: 'cpsAtLeast',
                regex: /(?:PD\s*-?\s*L1\s*)?CPS\s*(?:>=|≥|=>|at least)?\s*(\d+(?:\.\d+)?)/i,
                extract(match) { return { threshold: Number(match[1]), operator: '>=' }; }
            },
            { status: 'anyMention', regex: /PD\s*-?\s*L1|\bCPS\b/i }
        ],
        detect(text) {
            const source = normalized(text);
            if (!/PD\s*-?\s*L1|\bCPS\b/i.test(source)) return null;
            const match = /\bCPS\s*(?:score\s*)?(?:>=|≥|=>|=|of|at least)?\s*(\d+(?:\.\d+)?)/i.exec(source);
            if (match) return { status: 'cps', statuses: ['cps'], value: Number(match[1]), ruleId: 'PDL1_CPS', confidence: 0.97 };
            return { status: 'mentioned', statuses: [], ruleId: 'PDL1_MENTION', confidence: 0.55 };
        },
        matches(classification, filter) {
            if (filter.status === 'anyMention') return Boolean(classification.mentioned);
            if (filter.status !== 'cpsAtLeast') return false;
            const threshold = Number(filter.threshold);
            return classification.mentions.some((item) => item.role === 'eligibility' && item.status === 'cps' && Number(item.value) >= threshold);
        }
    });

    return { registered: ['CLDN18.2', 'FGFR2B', 'PD-L1'] };
});