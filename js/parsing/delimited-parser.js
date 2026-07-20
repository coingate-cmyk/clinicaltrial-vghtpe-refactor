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

    function detectDelimiter(text) {
        const sample = String(text || '').split(/\r?\n/).slice(0, 5).join('\n');
        const counts = [
            ['\t', (sample.match(/\t/g) || []).length],
            [',', (sample.match(/,/g) || []).length],
            [';', (sample.match(/;/g) || []).length]
        ].sort((a, b) => b[1] - a[1]);
        return counts[0][1] > 0 ? counts[0][0] : ',';
    }

    function parseRows(text, delimiter) {
        const source = String(text == null ? '' : text).replace(/^\uFEFF/, '');
        const sep = delimiter || detectDelimiter(source);
        const rows = [];
        let row = [];
        let value = '';
        let quoted = false;
        for (let index = 0; index < source.length; index += 1) {
            const char = source[index];
            if (quoted) {
                if (char === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
                else if (char === '"') quoted = false;
                else value += char;
                continue;
            }
            if (char === '"') quoted = true;
            else if (char === sep) { row.push(value); value = ''; }
            else if (char === '\n') {
                row.push(value.replace(/\r$/, ''));
                if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
                row = [];
                value = '';
            } else value += char;
        }
        row.push(value.replace(/\r$/, ''));
        if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
        return rows;
    }

    function parseDelimitedText(text, options) {
        const opts = options || {};
        const delimiter = opts.delimiter || detectDelimiter(text);
        const rows = parseRows(text, delimiter);
        if (!rows.length) return { records: [], diagnostics: { delimiter, rowCount: 0, recordCount: 0, mappedHeaders: [], unmappedHeaders: [] } };
        const result = tableApi.parseTable(rows[0], rows.slice(1), opts);
        result.diagnostics.delimiter = delimiter === '\t' ? 'tab' : delimiter;
        return result;
    }

    return { detectDelimiter, parseRows, parseDelimitedText };
});