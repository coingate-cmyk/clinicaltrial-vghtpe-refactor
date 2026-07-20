(function (root, factory) {
    const tableApi = typeof module === 'object' && module.exports
        ? require('./table-parser-core.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.parsing) || {};
    const api = factory(tableApi);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (tableApi) {
    'use strict';

    const SHEETJS_VERSION = '0.20.3';
    const SHEETJS_URL = `https://cdn.sheetjs.com/xlsx-${SHEETJS_VERSION}/package/dist/xlsx.full.min.js`;
    let sheetJsPromise = null;

    function loadSheetJs() {
        if (typeof globalThis !== 'undefined' && globalThis.XLSX) return Promise.resolve(globalThis.XLSX);
        if (sheetJsPromise) return sheetJsPromise;
        if (typeof document === 'undefined') return Promise.reject(new Error('SheetJS must be supplied outside a browser.'));
        sheetJsPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SHEETJS_URL;
            script.async = true;
            script.onload = () => globalThis.XLSX ? resolve(globalThis.XLSX) : reject(new Error('SheetJS loaded without exposing XLSX.'));
            script.onerror = () => reject(new Error('Unable to load the spreadsheet parser.'));
            document.head.appendChild(script);
        });
        return sheetJsPromise;
    }

    function findHeaderRow(matrix, maximumRows) {
        const limit = Math.min((matrix || []).length, maximumRows || 25);
        let best = { index: -1, mappedCount: 0, mapping: [] };
        for (let index = 0; index < limit; index += 1) {
            const mapping = tableApi.mapHeaders(matrix[index] || []);
            const mappedCount = mapping.filter((item) => item.field).length;
            if (mappedCount > best.mappedCount) best = { index, mappedCount, mapping };
        }
        return best;
    }

    function parseWorkbook(workbook, xlsx, options) {
        const opts = options || {};
        const records = [];
        const sheets = [];
        (workbook.SheetNames || []).forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const matrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
            const header = findHeaderRow(matrix, opts.maximumHeaderRows || 25);
            if (header.index < 0 || header.mappedCount < (opts.minimumMappedHeaders || 2)) {
                sheets.push({ sheetName, rowCount: matrix.length, skipped: true, reason: 'No recognizable header row.' });
                return;
            }
            const parsed = tableApi.parseTable(matrix[header.index], matrix.slice(header.index + 1), {
                sourceType: 'spreadsheet', sourceName: opts.sourceName || '', sourceId: sheetName
            });
            parsed.records.forEach((record, recordIndex) => {
                record.source = Object.assign({}, record.source, { sheetName, rowNumber: header.index + recordIndex + 2 });
                records.push(record);
            });
            sheets.push({
                sheetName,
                rowCount: matrix.length,
                headerRow: header.index + 1,
                mappedHeaderCount: header.mappedCount,
                recordCount: parsed.records.length,
                unmappedHeaders: parsed.diagnostics.unmappedHeaders.map((item) => item.original)
            });
        });
        return { format: 'spreadsheet', records, diagnostics: { sheetCount: sheets.length, recordCount: records.length, sheets }, raw: { sheets } };
    }

    async function parseSpreadsheetArrayBuffer(arrayBuffer, options, xlsxOverride) {
        const xlsx = xlsxOverride || await loadSheetJs();
        const workbook = xlsx.read(arrayBuffer, { type: 'array', cellDates: true, dense: false });
        return parseWorkbook(workbook, xlsx, options);
    }

    async function parseSpreadsheetFile(file, options, xlsxOverride) {
        if (!file || typeof file.arrayBuffer !== 'function') throw new TypeError('A File-like object with arrayBuffer() is required.');
        return parseSpreadsheetArrayBuffer(await file.arrayBuffer(), Object.assign({}, options, { sourceName: (options && options.sourceName) || file.name || '' }), xlsxOverride);
    }

    return { SHEETJS_VERSION, SHEETJS_URL, loadSheetJs, findHeaderRow, parseWorkbook, parseSpreadsheetArrayBuffer, parseSpreadsheetFile };
});