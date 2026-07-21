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
        { canonical: 'pending', patterns: [/not yet recruiting/i, /startup/i, /activation pending/i, /尚未收案/i, /準備中/i, /待啟動/i] },
        { canonical: 'temporarily_closed', patterns: [/temporarily closed/i, /suspended/i, /暫停收案/i, /暫停/i] },
        { canonical: 'closed', patterns: [/not recruiting/i, /closed to accrual/i, /terminated/i, /withdrawn/i, /停止收案/i, /關閉/i, /結束收案/i] },
        { canonical: 'recruiting', patterns: [/\brecruiting\b/i, /open to accrual/i, /actively enrolling/i, /收案中/i, /開放收案/i, /可收案/i] }
    ];

    const AVAILABILITY_ALIASES = [
        { canonical: 'pending', patterns: [/not yet recruiting/i, /startup/i, /activation pending/i, /尚未收案/i, /準備中/i, /待啟動/i] },
        { canonical: 'paused', patterns: [/temporarily closed/i, /suspended/i, /暫停收案/i, /暫停/i] },
        { canonical: 'full', patterns: [/\bfull\b/i, /no slots?/i, /quota filled/i, /accrual complete/i, /滿額/i, /額滿/i, /名額已滿/i, /無名額/i] },
        { canonical: 'closed', patterns: [/not recruiting/i, /closed to accrual/i, /terminated/i, /withdrawn/i, /停止收案/i, /關閉/i, /結束收案/i] },
        { canonical: 'limited', patterns: [/limited slots?/i, /few slots?/i, /waitlist/i, /少量名額/i, /名額有限/i, /剩餘\s*\d+\s*名/i] },
        { canonical: 'available', patterns: [/slots? available/i, /open slots?/i, /available for enrollment/i, /有名額/i, /尚有名額/i, /可收案/i, /開放收案/i] }
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

    function normalizeInteger(value) {
        if (value === '' || value == null) return null;
        if (typeof value === 'number' && Number.isInteger(value)) return value;
        const text = normalizeInlineText(value);
        if (!/^-?\d+$/.test(text)) return null;
        const number = Number(text);
        return Number.isInteger(number) ? number : null;
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

    function normalizeAvailability(value) {
        const text = normalizeInlineText(value);
        if (!text) return 'unknown';
        const canonicalValues = new Set(['available', 'limited', 'full', 'paused', 'closed', 'pending', 'unknown']);
        const compact = text.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
        if (canonicalValues.has(compact.replace(/ /g, '_'))) return compact.replace(/ /g, '_');
        for (const rule of AVAILABILITY_ALIASES) {
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
        const availabilityRaw = firstDefined(input, ['availabilityRaw', 'availability', 'slotStatus', 'slotAvailability', 'capacityStatus', 'localAvailability', 'localStatus']);
        const contactsInput = input.contacts || {};
        const enrollmentInput = input.siteEnrollment || input.enrollment || {};

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
            availability: normalizeAvailability(availabilityRaw),
            availabilityRaw: normalizeInlineText(availabilityRaw),
            active: normalizeBoolean(firstDefined(input, ['active', 'isActive', 'canEnroll'])),
            cancerTypes,
            treatmentLines: normalizeList(firstDefined(input, ['treatmentLines', 'line', 'lines', 'therapyLine'])),
            biomarkers: Array.isArray(input.biomarkers) ? input.biomarkers.slice() : [],
            inclusion: normalizeWhitespace(firstDefined(input, ['inclusion', 'inclusionCriteria', 'eligibility'])),
            exclusion: normalizeWhitespace(firstDefined(input, ['exclusion', 'exclusionCriteria'])),
            summary: normalizeWhitespace(firstDefined(input, ['summary', 'description', 'briefSummary'])),
            interventions: normalizeList(firstDefined(input, ['interventions', 'drugs', 'treatment', 'regimen'])),
            contacts: {
                pi: normalizeInlineText(firstDefined(input, ['pi', 'principalInvestigator', 'investigator']) || firstDefined(contactsInput, ['pi', 'principalInvestigator', 'investigator'])),
                nurse: normalizeInlineText(firstDefined(input, ['nurse', 'studyNurse', 'coordinator', 'crc']) || firstDefined(contactsInput, ['nurse', 'studyNurse', 'coordinator', 'crc'])),
                phone: normalizeInlineText(firstDefined(input, ['phone', 'contactPhone']) || firstDefined(contactsInput, ['phone', 'contactPhone'])),
                email: normalizeInlineText(firstDefined(input, ['email', 'contactEmail']) || firstDefined(contactsInput, ['email', 'contactEmail'])),
                lineId: normalizeInlineText(firstDefined(input, ['lineId', 'lineID', 'lineAccount']) || firstDefined(contactsInput, ['lineId', 'lineID', 'lineAccount'])),
                raw: normalizeWhitespace(firstDefined(input, ['contactRaw', 'studyNursePhone', 'contactBlock']) || firstDefined(contactsInput, ['raw', 'contactRaw', 'studyNursePhone', 'contactBlock'])),
                verifiedAt: normalizeDate(firstDefined(input, ['contactVerifiedAt']) || firstDefined(contactsInput, ['verifiedAt', 'contactVerifiedAt'])),
                verifiedBy: normalizeInlineText(firstDefined(input, ['contactVerifiedBy']) || firstDefined(contactsInput, ['verifiedBy', 'contactVerifiedBy'])),
                sourceName: normalizeInlineText(firstDefined(input, ['contactSource']) || firstDefined(contactsInput, ['sourceName', 'source']))
            },
            siteEnrollment: {
                enrolledCount: normalizeInteger(firstDefined(input, ['enrolledCount', 'siteEnrolled', 'currentEnrollment', '已收案人數']) || firstDefined(enrollmentInput, ['enrolledCount', 'siteEnrolled', 'currentEnrollment'])),
                targetCount: normalizeInteger(firstDefined(input, ['targetCount', 'siteTarget', 'targetEnrollment', '預計收案人數']) || firstDefined(enrollmentInput, ['targetCount', 'siteTarget', 'targetEnrollment'])),
                monthlySignedCount: normalizeInteger(firstDefined(input, ['monthlySignedCount', 'signedThisMonth', '當月簽署人數']) || firstDefined(enrollmentInput, ['monthlySignedCount', 'signedThisMonth'])),
                monthlyEnrolledCount: normalizeInteger(firstDefined(input, ['monthlyEnrolledCount', 'enrolledThisMonth', '當月入案人數']) || firstDefined(enrollmentInput, ['monthlyEnrolledCount', 'enrolledThisMonth'])),
                remainingSlots: normalizeInteger(firstDefined(input, ['remainingSlots', 'slotsRemaining', '剩餘名額']) || firstDefined(enrollmentInput, ['remainingSlots', 'slotsRemaining'])),
                raw: normalizeWhitespace(firstDefined(input, ['enrollmentRaw', 'siteEnrollmentRaw']) || firstDefined(enrollmentInput, ['raw', 'enrollmentRaw'])),
                lastVerifiedAt: normalizeDate(firstDefined(input, ['enrollmentVerifiedAt', 'lastVerifiedAt']) || firstDefined(enrollmentInput, ['lastVerifiedAt', 'verifiedAt'])),
                verifiedBy: normalizeInlineText(firstDefined(input, ['enrollmentVerifiedBy']) || firstDefined(enrollmentInput, ['verifiedBy'])),
                sourceName: normalizeInlineText(firstDefined(input, ['enrollmentSource']) || firstDefined(enrollmentInput, ['sourceName', 'source']))
            },
            sites: normalizeList(firstDefined(input, ['sites', 'site', 'locations'])),
            notes: normalizeWhitespace(firstDefined(input, ['notes', 'comments', 'remark', 'remarks'])),
            source: {
                type: normalizeInlineText(firstDefined(input.source || input, ['type', 'sourceType'])) || normalizeInlineText(opts.sourceType),
                name: normalizeInlineText(firstDefined(input.source || input, ['name', 'sourceName', 'fileName'])) || normalizeInlineText(opts.sourceName),
                sourceId,
                pageNumber: normalizeInteger(firstDefined(input.source || input, ['pageNumber', 'page'])),
                endPageNumber: normalizeInteger(firstDefined(input.source || input, ['endPageNumber', 'endPage'])),
                rowNumber: normalizeInteger(firstDefined(input.source || input, ['rowNumber', 'row'])),
                importedAt: normalizeDate(firstDefined(input.source || input, ['importedAt', 'date'])) || normalizeDate(opts.importedAt)
            },
            fieldMeta: input.fieldMeta && typeof input.fieldMeta === 'object' ? JSON.parse(JSON.stringify(input.fieldMeta)) : {},
            changeLog: Array.isArray(input.changeLog) ? JSON.parse(JSON.stringify(input.changeLog)) : [],
            provenance: Array.isArray(input.provenance) ? input.provenance.slice() : [],
            classifications: input.classifications && typeof input.classifications === 'object' ? Object.assign({}, input.classifications) : {},
            createdAt: normalizeDate(input.createdAt),
            updatedAt: normalizeDate(input.updatedAt)
        };
    }

    return {
        CANCER_ALIASES, STATUS_ALIASES, AVAILABILITY_ALIASES, normalizeUnicode, normalizeWhitespace, normalizeInlineText,
        normalizeCode, compactCode, normalizeBoolean, normalizeInteger, normalizeList, normalizeCancerLabel,
        normalizePhase, normalizeEnrollmentStatus, normalizeAvailability, normalizeDate, normalizeCancerTypes, normalizeTrial
    };
});