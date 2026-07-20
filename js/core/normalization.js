(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.core = Object.assign(root.ClinicalTrialApp.core || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CANCER_ALIASES = [
        { canonical: '胃癌/胃食道交界腺癌', patterns: [/胃癌/i, /胃食道交界/i, /gastric/i, /gastro[- ]?esophageal junction/i, /\bGEJ\b/i] },
        { canonical: '食道鱗狀細胞癌', patterns: [/食道.*鱗/i, /esophageal squamous/i, /\bESCC\b/i] },
        { canonical: '食道腺癌', patterns: [/食道.*腺癌/i, /esophageal adenocarcinoma/i, /\bEAC\b/i] },
        { canonical: '肝細胞癌', patterns: [/肝細胞癌/i, /hepatocellular/i, /\bHCC\b/i] },
        { canonical: '膽道癌', patterns: [/膽道癌/i, /膽管癌/i, /biliary tract/i, /cholangiocarcinoma/i, /\bBTC\b/i] },
        { canonical: '胰臟癌', patterns: [/胰臟癌/i, /胰腺癌/i, /pancreatic/i, /\bPDAC\b/i] },
        { canonical: '大腸直腸癌', patterns: [/大腸癌/i, /直腸癌/i, /結直腸癌/i, /colorectal/i, /colon cancer/i, /rectal cancer/i, /\bCRC\b/i] },
        { canonical: '胃腸道基質瘤', patterns: [/胃腸道基質瘤/i, /gastrointestinal stromal/i, /\bGIST\b/i] },
        { canonical: '神經內分泌腫瘤', patterns: [/神經內分泌/i, /neuroendocrine/i, /\bNET\b/i, /\bNEC\b/i] },
        { canonical: '肛門癌', patterns: [/肛門癌/i, /anal cancer/i, /anal squamous/i] },
        { canonical: '泛實體腫瘤', patterns: [/solid tumou?rs?/i, /實體腫瘤/i, /basket/i, /tumor agnostic/i] }
    ];

    const STATUS_ALIASES = [
        { canonical: 'recruiting', patterns: [/recruiting/i, /open to accrual/i, /actively enrolling/i, /收案中/i, /開放收案/i, /可收案/i] },
        { canonical: 'temporarily_closed', patterns: [/temporarily closed/i, /suspended/i, /暫停收案/i, /暫停/i] },
        { canonical: 'closed', patterns: [/not recruiting/i, /closed to accrual/i, /terminated/i, /withdrawn/i, /停止收案/i, /關閉/i, /結束收案/i] },
        { canonical: 'pending', patterns: [/not yet recruiting/i, /startup/i, /activation pending/i, /尚未收案/i, /準備中/i, /待啟動/i] }
    ];

    function normalizeUnicode(value) {
        return String(value == null ? '' : value)
            .normalize('NFKC')
            .replace(/[–—−]/g, '-')
            .replace(/[＋]/g, '+')
            .replace(/[（]/g, '(')
            .replace(/[）]/g, ')')
            .replace(/\u00A0/g, ' ');
    }

    function normalizeWhitespace(value) {
        return normalizeUnicode(value)
            .replace(/\r\n?/g, '\n')
            .replace(/[\t ]+/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function normalizeInlineText(value) {
        return normalizeWhitespace(value).replace(/\s*\n\s*/g, ' ').trim();
    }

    function normalizeCode(value) {
        const raw = normalizeInlineText(value).toUpperCase();
        if (!raw) return '';
        return raw
            .replace(/[‐‑‒–—−]/g, '-')
            .replace(/\s*[-/]\s*/g, '-')
            .replace(/\s+/g, '')
            .replace(/-{2,}/g, '-')
            .replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '');
    }

    function compactCode(value) {
        return normalizeCode(value).replace(/[^A-Z0-9]/g, '');
    }

    function normalizeBoolean(value) {
        if (typeof value === 'boolean') return value;
        const text = normalizeInlineText(value).toLowerCase();
        if (['1', 'true', 'yes', 'y', '是', '可', 'open'].includes(text)) return true;
        if (['0', 'false', 'no', 'n', '否', '不可', 'closed'].includes(text)) return false;
        return null;
    }

    function normalizeList(value) {
        const values = Array.isArray(value) ? value : normalizeWhitespace(value).split(/\n|[;,；，、]/);
        const seen = new Set();
        const result = [];
        values.forEach((item) => {
            const normalized = normalizeInlineText(item);
            if (!normalized) return;
            const key = normalized.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            result.push(normalized);
        });
        return result;
    }

    function normalizeCancerLabel(value) {
        const text = normalizeInlineText(value);
        if (!text) return '';
        for (const rule of CANCER_ALIASES) {
            if (rule.patterns.some((pattern) => pattern.test(text))) return rule.canonical;
        }
        return text;
    }

    function normalizePhase(value) {
        const text = normalizeInlineText(value).toUpperCase();
        if (!text) return '';
        const match = text.match(/(?:PHASE|第)?\s*(I{1,3}|IV|[1-4])(?:\s*[/|-]\s*(I{1,3}|IV|[1-4]))?/i);
        if (!match) return text;
        const convert = (part) => ({ I: '1', II: '2', III: '3', IV: '4' }[String(part).toUpperCase()] || String(part));
        return match[2] ? `${convert(match[1])}/${convert(match[2])}` : convert(match[1]);
    }

    function normalizeEnrollmentStatus(value) {
        const text = normalizeInlineText(value);
        if (!text) return 'unknown';
        for (const rule of STATUS_ALIASES) {
            if (rule.patterns.some((pattern) => pattern.test(text))) return rule.canonical;
        }
        return 'unknown';
    }

    function normalizeDate(value) {
        if (!value) return '';
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
        const text = normalizeInlineText(value);
        const match = text.match(/\b(20\d{2}|19\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
        if (!match) return text;
        return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }

    function firstDefined(object, aliases) {
        for (const key of aliases) {
            if (object && object[key] != null && String(object[key]).trim() !== '') return object[key];
        }
        return '';
    }

    function normalizeCancerTypes(raw) {
        const source = raw && raw.cancerTypes;
        if (Array.isArray(source)) {
            return source.map((entry) => {
                if (typeof entry === 'string') return { type: normalizeCancerLabel(entry), lines: [] };
                return {
                    type: normalizeCancerLabel(entry && (entry.type || entry.cancerType || entry.name)),
                    lines: normalizeList(entry && (entry.lines || entry.line || entry.treatmentLines))
                };
            }).filter((entry) => entry.type);
        }
        const direct = firstDefined(raw, ['cancerType', 'cancer', 'tumorType', 'indication', 'disease']);
        return normalizeList(direct).map((type) => ({ type: normalizeCancerLabel(type), lines: [] })).filter((entry) => entry.type);
    }

    function normalizeTrial(raw, options) {
        const input = raw || {};
        const opts = options || {};
        const code = normalizeCode(firstDefined(input, ['code', 'studyCode', 'protocolNumber', 'protocolNo', 'trialCode', 'studyId']));
        const cancerTypes = normalizeCancerTypes(input);
        const sourceId = normalizeInlineText(firstDefined(input, ['sourceId', 'rowId', 'documentId']) || firstDefined(input.source, ['sourceId', 'rowId', 'documentId']));
        const generatedId = code ? `trial:${compactCode(code)}` : (sourceId ? `source:${sourceId}` : '');
        const statusRaw = firstDefined(input, ['statusRaw', 'status', 'enrollmentStatus', 'recruitmentStatus', 'studyStatus']);

        return {
            schemaVersion: 1,
            id: normalizeInlineText(input.id) || generatedId,
            code,
            title: normalizeInlineText(firstDefined(input, ['title', 'studyTitle', 'protocolTitle', 'name'])),
            shortTitle: normalizeInlineText(firstDefined(input, ['shortTitle', 'briefTitle'])),
            sponsor: normalizeInlineText(firstDefined(input, ['sponsor', 'company', 'organization'])),
            phase: normalizePhase(firstDefined(input, ['phase', 'studyPhase'])),
            status: normalizeEnrollmentStatus(statusRaw),
            statusRaw: normalizeInlineText(statusRaw),
            active: normalizeBoolean(firstDefined(input, ['active', 'isActive', 'canEnroll'])),
            cancerTypes,
            treatmentLines: normalizeList(firstDefined(input, ['treatmentLines', 'line', 'lines', 'therapyLine'])),
            biomarkers: Array.isArray(input.biomarkers) ? input.biomarkers.slice() : [],
            inclusion: normalizeWhitespace(firstDefined(input, ['inclusion', 'inclusionCriteria', 'eligibility'])),
            exclusion: normalizeWhitespace(firstDefined(input, ['exclusion', 'exclusionCriteria'])),
            summary: normalizeWhitespace(firstDefined(input, ['summary', 'description', 'briefSummary'])),
            interventions: normalizeList(firstDefined(input, ['interventions', 'drugs', 'treatment', 'regimen'])),
            contacts: {
                pi: normalizeInlineText(firstDefined(input, ['pi', 'principalInvestigator', 'investigator']) || firstDefined(input.contacts, ['pi', 'principalInvestigator', 'investigator'])),
                nurse: normalizeInlineText(firstDefined(input, ['nurse', 'studyNurse', 'coordinator', 'crc']) || firstDefined(input.contacts, ['nurse', 'studyNurse', 'coordinator', 'crc'])),
                phone: normalizeInlineText(firstDefined(input, ['phone', 'contactPhone']) || firstDefined(input.contacts, ['phone', 'contactPhone'])),
                email: normalizeInlineText(firstDefined(input, ['email', 'contactEmail']) || firstDefined(input.contacts, ['email', 'contactEmail']))
            },
            sites: normalizeList(firstDefined(input, ['sites', 'site', 'locations'])),
            notes: normalizeWhitespace(firstDefined(input, ['notes', 'comments', 'remark', 'remarks'])),
            source: {
                type: normalizeInlineText(firstDefined(input.source || input, ['type', 'sourceType'])) || normalizeInlineText(opts.sourceType),
                name: normalizeInlineText(firstDefined(input.source || input, ['name', 'sourceName', 'fileName'])) || normalizeInlineText(opts.sourceName),
                sourceId,
                importedAt: normalizeDate(firstDefined(input.source || input, ['importedAt', 'date'])) || normalizeDate(opts.importedAt)
            },
            provenance: Array.isArray(input.provenance) ? input.provenance.slice() : [],
            classifications: input.classifications && typeof input.classifications === 'object' ? Object.assign({}, input.classifications) : {},
            createdAt: normalizeDate(input.createdAt),
            updatedAt: normalizeDate(input.updatedAt)
        };
    }

    return {
        CANCER_ALIASES, STATUS_ALIASES, normalizeUnicode, normalizeWhitespace, normalizeInlineText,
        normalizeCode, compactCode, normalizeBoolean, normalizeList, normalizeCancerLabel,
        normalizePhase, normalizeEnrollmentStatus, normalizeDate, normalizeCancerTypes, normalizeTrial
    };
});