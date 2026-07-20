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
    const HEADER_ALIASES = {
        code: ['study code', 'trial code', 'protocol no', 'protocol number', 'study id', '試驗代號', '計畫編號', '研究編號'],
        title: ['study title', 'protocol title', 'title', '試驗名稱', '研究名稱'],
        sponsor: ['sponsor', 'company', '廠商', '申請廠商'],
        phase: ['phase', 'study phase', '期別', '試驗期別'],
        statusRaw: ['status', 'study status', 'recruitment status', '收案狀態', '研究狀態'],
        cancerType: ['cancer type', 'tumor type', 'indication', 'disease', '癌別', '疾病別'],
        treatmentLines: ['line', 'treatment line', 'therapy line', '線別', '治療線別'],
        inclusion: ['inclusion', 'inclusion criteria', 'eligibility', '納入條件', '收案條件'],
        exclusion: ['exclusion', 'exclusion criteria', '排除條件', '排除標準'],
        notes: ['notes', 'comments', 'remarks', '備註', '說明']
    };
    function normalizeHeader(value) {
        return normalization.normalizeInlineText(value).toLowerCase().replace(/[\s_\-/()（）:：.]+/g, '');
    }
    const HEADER_LOOKUP = Object.entries(HEADER_ALIASES).reduce((lookup, entry) => {
        entry[1].forEach((alias) => lookup.set(normalizeHeader(alias), entry[0]));
        return lookup;
    }, new Map());
    function mapHeaders(headers) {
        return (headers || []).map((header, index) => ({ index, original: normalization.normalizeInlineText(header), field: HEADER_LOOKUP.get(normalizeHeader(header)) || '' }));
    }
    function rowToRecord(row, headerMap, options) {
        const record = {};
        (headerMap || []).forEach((mapping) => {
            if (!mapping.field) return;
            const value = Array.isArray(row) ? row[mapping.index] : row && row[mapping.original];
            if (value == null || String(value).trim() === '') return;
            if (record[mapping.field] == null) record[mapping.field] = value;
            else record[mapping.field] = `${record[mapping.field]}\n${value}`;
        });
        record.source = { type: (options && options.sourceType) || 'table', name: (options && options.sourceName) || '', sourceId: (options && options.sourceId) || '' };
        return record;
    }
    function parseTable(headers, rows, options) {
        const mapping = mapHeaders(headers);
        const records = (rows || []).map((row) => rowToRecord(row, mapping, options)).filter((record) => Object.keys(record).length > 1);
        return { records, diagnostics: { rowCount: (rows || []).length, recordCount: records.length, mappedHeaders: mapping.filter((item) => item.field), unmappedHeaders: mapping.filter((item) => !item.field) } };
    }
    return { HEADER_ALIASES, normalizeHeader, mapHeaders, rowToRecord, parseTable };
});