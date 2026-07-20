(function (root, factory) {
    const tableApi = typeof module === 'object' && module.exports
        ? require('./table-parser-core.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.parsing) || {};
    const normalization = typeof module === 'object' && module.exports
        ? require('../core/normalization.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.core) || {};
    const api = factory(tableApi, normalization);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
        const parsing = root.ClinicalTrialApp.parsing;
        if (typeof parsing.parsePdfFile === 'function' && !parsing.parsePdfFile.__tableEnhanced) {
            const originalFile = parsing.parsePdfFile;
            const enhancedFile = async function () {
                return api.enhancePdfResult(await originalFile.apply(this, arguments));
            };
            enhancedFile.__tableEnhanced = true;
            parsing.parsePdfFile = enhancedFile;
        }
        if (typeof parsing.parsePdfArrayBuffer === 'function' && !parsing.parsePdfArrayBuffer.__tableEnhanced) {
            const originalBuffer = parsing.parsePdfArrayBuffer;
            const enhancedBuffer = async function () {
                return api.enhancePdfResult(await originalBuffer.apply(this, arguments));
            };
            enhancedBuffer.__tableEnhanced = true;
            parsing.parsePdfArrayBuffer = enhancedBuffer;
        }
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (tableApi, normalization) {
    'use strict';

    function lineCells(line, options) {
        const opts = Object.assign({ minimumGap: 14 }, options || {});
        const items = (line && line.items || []).slice().sort((a, b) => a.x - b.x);
        const cells = [];
        let current = null;
        items.forEach((item) => {
            if (!current) {
                current = { x: item.x, end: item.x + item.width, items: [item], text: item.text };
                return;
            }
            const gap = item.x - current.end;
            const adaptiveGap = Math.max(opts.minimumGap, Math.min(item.height || 10, current.items[current.items.length - 1].height || 10) * 1.25);
            if (gap > adaptiveGap) {
                cells.push(current);
                current = { x: item.x, end: item.x + item.width, items: [item], text: item.text };
            } else {
                const spacer = gap > 1.5 && !/\s$/.test(current.text) && !/^\s/.test(item.text) ? ' ' : '';
                current.text += spacer + item.text;
                current.end = Math.max(current.end, item.x + item.width);
                current.items.push(item);
            }
        });
        if (current) cells.push(current);
        return cells.map((cell) => Object.assign(cell, { text: normalization.normalizeInlineText(cell.text) })).filter((cell) => cell.text);
    }

    function findHeaderLine(lines, options) {
        const opts = Object.assign({ minimumMappedHeaders: 3, maximumLines: 30 }, options || {});
        let best = null;
        (lines || []).slice(0, opts.maximumLines).forEach((line, lineIndex) => {
            const cells = lineCells(line, opts);
            const mapping = tableApi.mapHeaders(cells.map((cell) => cell.text));
            const mappedCount = mapping.filter((item) => item.field).length;
            const keyFields = new Set(mapping.filter((item) => item.field).map((item) => item.field));
            const hasIdentity = keyFields.has('code') || keyFields.has('title');
            if (!hasIdentity || mappedCount < opts.minimumMappedHeaders) return;
            if (!best || mappedCount > best.mappedCount) best = { lineIndex, line, cells, mapping, mappedCount };
        });
        return best;
    }

    function buildColumns(header) {
        const mapped = header.mapping.map((mapping, index) => ({
            field: mapping.field,
            original: mapping.original,
            x: header.cells[index].x,
            end: header.cells[index].end
        })).filter((column) => column.field).sort((a, b) => a.x - b.x);
        return mapped.map((column, index) => ({
            field: column.field,
            original: column.original,
            x: column.x,
            left: index === 0 ? -Infinity : (mapped[index - 1].x + column.x) / 2,
            right: index === mapped.length - 1 ? Infinity : (column.x + mapped[index + 1].x) / 2
        }));
    }

    function assignLineToColumns(line, columns) {
        const values = Object.fromEntries((columns || []).map((column) => [column.field, '']));
        (line && line.items || []).slice().sort((a, b) => a.x - b.x).forEach((item) => {
            const column = columns.find((candidate) => item.x >= candidate.left && item.x < candidate.right);
            if (!column) return;
            const current = values[column.field];
            const spacer = current && !/\s$/.test(current) && !/^\s/.test(item.text) ? ' ' : '';
            values[column.field] = current + spacer + item.text;
        });
        Object.keys(values).forEach((field) => { values[field] = normalization.normalizeInlineText(values[field]); });
        return values;
    }

    function isRepeatedHeader(values) {
        const mapped = tableApi.mapHeaders(Object.values(values));
        return mapped.filter((item) => item.field).length >= 2;
    }

    function appendContinuation(target, values) {
        Object.entries(values).forEach(([field, value]) => {
            if (!value) return;
            if (!target[field]) target[field] = value;
            else if (target[field] !== value) target[field] += `\n${value}`;
        });
    }

    function extractPdfTableRecords(pages, options) {
        const opts = Object.assign({ minimumRecords: 2 }, options || {});
        const records = [];
        const pageDiagnostics = [];
        (pages || []).forEach((page) => {
            const header = findHeaderLine(page.lines, opts);
            if (!header) {
                pageDiagnostics.push({ pageNumber: page.pageNumber, tableDetected: false, recordCount: 0 });
                return;
            }
            const columns = buildColumns(header);
            const hasCodeColumn = columns.some((column) => column.field === 'code');
            let current = null;
            let pageRecordCount = 0;
            page.lines.slice(header.lineIndex + 1).forEach((line) => {
                const values = assignLineToColumns(line, columns);
                if (!Object.values(values).some(Boolean) || isRepeatedHeader(values)) return;
                const hasIdentity = hasCodeColumn
                    ? Boolean(normalization.normalizeCode(values.code))
                    : Boolean(values.title);
                if (hasIdentity) {
                    current = Object.assign({}, values, {
                        source: { type: 'pdf-table', sourceId: `page-${page.pageNumber}-row-${pageRecordCount + 1}`, pageNumber: page.pageNumber }
                    });
                    records.push(current);
                    pageRecordCount += 1;
                } else if (current) appendContinuation(current, values);
            });
            pageDiagnostics.push({
                pageNumber: page.pageNumber,
                tableDetected: true,
                headerLine: header.lineIndex + 1,
                mappedHeaderCount: header.mappedCount,
                columns: columns.map((column) => column.field),
                recordCount: pageRecordCount
            });
        });
        return {
            records,
            diagnostics: {
                mode: records.length >= opts.minimumRecords ? 'table' : 'document',
                recordCount: records.length,
                pages: pageDiagnostics
            }
        };
    }

    function enhancePdfResult(result, options) {
        if (!result || !result.raw || !Array.isArray(result.raw.pages)) return result;
        const table = extractPdfTableRecords(result.raw.pages, options);
        result.diagnostics = Object.assign({}, result.diagnostics, { tableExtraction: table.diagnostics });
        if (table.diagnostics.mode === 'table') {
            result.records = table.records;
            result.diagnostics.extractionMode = 'table';
        } else result.diagnostics.extractionMode = 'document';
        return result;
    }

    return { lineCells, findHeaderLine, buildColumns, assignLineToColumns, appendContinuation, extractPdfTableRecords, enhancePdfResult };
});