(function (root, factory) {
    const normalization = typeof module === 'object' && module.exports
        ? require('../core/normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(normalization);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normalization) {
    'use strict';

    const CODE_PATTERNS = [
        /(?:protocol|study|trial)\s*(?:number|no\.?|id|code)?\s*[:：#]?\s*([A-Z0-9][A-Z0-9._/-]{3,30})/i,
        /(?:計畫編號|試驗編號|研究編號)\s*[:：#]?\s*([A-Z0-9][A-Z0-9._/-]{3,30})/i,
        /\b([A-Z]{1,8}[-/]?[A-Z0-9]{2,}(?:[-/][A-Z0-9]{2,})+)\b/
    ];

    const SECTION_RULES = [
        { key: 'inclusion', patterns: [/^inclusion(?: criteria)?\s*[:：]?$/i, /^納入條件\s*[:：]?$/, /^收案條件\s*[:：]?$/] },
        { key: 'exclusion', patterns: [/^exclusion(?: criteria)?\s*[:：]?$/i, /^排除條件\s*[:：]?$/, /^排除標準\s*[:：]?$/] },
        { key: 'title', patterns: [/^(?:official |brief )?title\s*[:：]?$/i, /^研究名稱\s*[:：]?$/, /^試驗名稱\s*[:：]?$/] },
        { key: 'statusRaw', patterns: [/^(?:recruitment |study )?status\s*[:：]?$/i, /^收案狀態\s*[:：]?$/, /^研究狀態\s*[:：]?$/] },
        { key: 'sponsor', patterns: [/^sponsor\s*[:：]?$/i, /^申請廠商\s*[:：]?$/, /^贊助者\s*[:：]?$/] },
        { key: 'phase', patterns: [/^phase\s*[:：]?$/i, /^試驗期別\s*[:：]?$/] }
    ];

    function cleanLines(text) {
        return normalization.normalizeUnicode(text)
            .replace(/\r\n?/g, '\n')
            .split('\n')
            .map((line) => normalization.normalizeInlineText(line))
            .filter(Boolean);
    }

    function detectStudyCode(text) {
        const source = normalization.normalizeWhitespace(text);
        for (const pattern of CODE_PATTERNS) {
            const match = pattern.exec(source);
            if (match) return { value: normalization.normalizeCode(match[1]), evidence: match[0], pattern: pattern.source };
        }
        return { value: '', evidence: '', pattern: '' };
    }

    function matchHeading(line) {
        for (const rule of SECTION_RULES) {
            if (rule.patterns.some((pattern) => pattern.test(line))) return rule.key;
        }
        const inline = line.match(/^(inclusion(?: criteria)?|exclusion(?: criteria)?|(?:official |brief )?title|(?:recruitment |study )?status|sponsor|phase|納入條件|收案條件|排除條件|排除標準|研究名稱|試驗名稱|收案狀態|研究狀態|申請廠商|贊助者|試驗期別)\s*[:：]\s*(.+)$/i);
        if (!inline) return null;
        for (const rule of SECTION_RULES) {
            if (rule.patterns.some((pattern) => pattern.test(inline[1]))) return { key: rule.key, value: inline[2] };
        }
        return null;
    }

    function parseDocumentText(text, options) {
        const lines = cleanLines(text);
        const sections = { inclusion: [], exclusion: [], title: [], statusRaw: [], sponsor: [], phase: [] };
        const unassigned = [];
        let current = '';

        lines.forEach((line) => {
            const heading = matchHeading(line);
            if (heading) {
                if (typeof heading === 'string') current = heading;
                else { current = heading.key; sections[current].push(heading.value); }
                return;
            }
            if (current && sections[current]) sections[current].push(line);
            else unassigned.push(line);
        });

        const code = detectStudyCode(text);
        const likelyTitle = sections.title.join(' ') || unassigned.find((line) => line.length >= 25 && !CODE_PATTERNS.some((pattern) => pattern.test(line))) || '';
        const record = {
            code: code.value,
            title: likelyTitle,
            sponsor: sections.sponsor.join(' '),
            phase: sections.phase.join(' '),
            statusRaw: sections.statusRaw.join(' '),
            inclusion: sections.inclusion.join('\n'),
            exclusion: sections.exclusion.join('\n'),
            summary: unassigned.slice(0, 12).join('\n'),
            source: {
                type: (options && options.sourceType) || 'document-text',
                name: (options && options.sourceName) || '',
                sourceId: (options && options.sourceId) || ''
            },
            provenance: [
                { field: 'code', value: code.value, evidence: code.evidence, parser: 'document-text-parser' },
                { field: 'title', value: likelyTitle, evidence: likelyTitle, parser: 'document-text-parser' }
            ].filter((item) => item.value)
        };

        return {
            records: [record],
            diagnostics: {
                lineCount: lines.length,
                assignedSectionLines: Object.values(sections).reduce((sum, values) => sum + values.length, 0),
                unassignedLines: unassigned.length,
                codeDetected: Boolean(code.value)
            }
        };
    }

    return { CODE_PATTERNS, SECTION_RULES, cleanLines, detectStudyCode, parseDocumentText };
});