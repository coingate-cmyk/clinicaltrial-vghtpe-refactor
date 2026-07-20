(function (root, factory) {
    const pdfApi = typeof module === 'object' && module.exports ? require('./pdf-browser-parser.js') : root.ClinicalTrialApp.parsing;
    const xlsxApi = typeof module === 'object' && module.exports ? require('./xlsx-browser-parser.js') : root.ClinicalTrialApp.parsing;
    const delimitedApi = typeof module === 'object' && module.exports ? require('./delimited-parser.js') : root.ClinicalTrialApp.parsing;
    const documentApi = typeof module === 'object' && module.exports ? require('./document-text-parser.js') : root.ClinicalTrialApp.parsing;
    const api = factory(pdfApi, xlsxApi, delimitedApi, documentApi);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (pdfApi, xlsxApi, delimitedApi, documentApi) {
    'use strict';

    function fileExtension(name) {
        const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        return match ? match[1] : '';
    }

    function detectFileFormat(file, requestedFormat) {
        if (requestedFormat && requestedFormat !== 'auto') return requestedFormat;
        const extension = fileExtension(file && file.name);
        const mime = String(file && file.type || '').toLowerCase();
        if (extension === 'pdf' || mime === 'application/pdf') return 'pdf';
        if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(extension) || /spreadsheet|excel|sheet/.test(mime)) return 'spreadsheet';
        if (extension === 'json' || mime === 'application/json') return 'json';
        if (['csv', 'tsv'].includes(extension) || /csv|tab-separated/.test(mime)) return 'table';
        return 'document';
    }

    async function parseFile(file, options) {
        const opts = options || {};
        const format = detectFileFormat(file, opts.format);
        if (format === 'pdf') return pdfApi.parsePdfFile(file, opts, opts.pdfjs);
        if (format === 'spreadsheet' || format === 'excel') return xlsxApi.parseSpreadsheetFile(file, opts, opts.xlsx);
        const text = await file.text();
        if (format === 'json') {
            const value = JSON.parse(text);
            const records = Array.isArray(value) ? value : (Array.isArray(value.trials) ? value.trials : [value]);
            return { format: 'json', records, diagnostics: { recordCount: records.length }, raw: { text } };
        }
        if (format === 'table') {
            const parsed = delimitedApi.parseDelimitedText(text, { sourceName: file.name || '', sourceType: 'delimited-file' });
            return Object.assign({ format: 'table', raw: { text } }, parsed);
        }
        const parsed = documentApi.parseDocumentText(text, { sourceName: file.name || '', sourceType: 'text-file' });
        return Object.assign({ format: 'document', raw: { text } }, parsed);
    }

    return { fileExtension, detectFileFormat, parseFile };
});