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
        if (typeof parsing.parsePdfFile === 'function' && !parsing.parsePdfFile.__fieldIntegrity) {
            const originalFile = parsing.parsePdfFile;
            const wrappedFile = async function () {
                return api.enforcePdfFieldIntegrity(await originalFile.apply(this, arguments));
            };
            wrappedFile.__fieldIntegrity = true;
            parsing.parsePdfFile = wrappedFile;
        }
        if (typeof parsing.parsePdfArrayBuffer === 'function' && !parsing.parsePdfArrayBuffer.__fieldIntegrity) {
            const originalBuffer = parsing.parsePdfArrayBuffer;
            const wrappedBuffer = async function () {
                return api.enforcePdfFieldIntegrity(await originalBuffer.apply(this, arguments));
            };
            wrappedBuffer.__fieldIntegrity = true;
            parsing.parsePdfArrayBuffer = wrappedBuffer;
        }
        if (typeof parsing.planImport === 'function' && !parsing.planImport.__fieldIntegrity) {
            const originalPlan = parsing.planImport;
            const wrappedPlan = function () {
                return api.enforceImportReview(originalPlan.apply(this, arguments));
            };
            wrappedPlan.__fieldIntegrity = true;
            parsing.planImport = wrappedPlan;
        }
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (tableApi, normalization) {
    'use strict';

    const EXTRA_HEADERS = {
        lineId: ['line id', 'lineid', 'line account', 'line 帳號', 'line帳號'],
        enrolledCount: ['enrolled count', 'current enrollment', 'site enrolled', '已收案人數', '目前收案人數'],
        targetCount: ['target count', 'target enrollment', 'site target', '目標人數', '預計收案人數'],
        remainingSlots: ['remaining slots', 'slots remaining', '剩餘名額', '可用名額']
    };
    const CRITICAL_FIELDS = new Set(['pi', 'nurse', 'phone', 'email', 'lineId']);

    function normalizeHeader(value) {
        return normalization.normalizeInlineText(value).toLowerCase().replace(/[\s_\-/()（）:：.]+/g, '');
    }

    const EXTRA_LOOKUP = Object.entries(EXTRA_HEADERS).reduce((lookup, entry) => {
        entry[1].forEach((alias) => lookup.set(normalizeHeader(alias), entry[0]));
        return lookup;
    }, new Map());

    function mapHeadersStrict(headers) {
        return tableApi.mapHeaders(headers).map((mapping) => {
            if (mapping.field) return mapping;
            return Object.assign({}, mapping, { field: EXTRA_LOOKUP.get(normalizeHeader(mapping.original)) || '' });
        });
    }

    function lineCells(line, options) {
        const opts = Object.assign({ minimumGap: 10 }, options || {});
        const items = (line && line.items || []).slice().sort((a, b) => a.x - b.x);
        const cells = [];
        let current = null;
        items.forEach((item) => {
            if (!current) {
                current = { x: item.x, end: item.x + item.width, items: [item], text: item.text };
                return;
            }
            const gap = item.x - current.end;
            const threshold = Math.max(opts.minimumGap, Math.min(item.height || 10, current.items[current.items.length - 1].height || 10));
            if (gap > threshold) {
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

    function findHeaderLineStrict(lines, options) {
        const opts = Object.assign({ minimumMappedHeaders: 3, maximumLines: 35 }, options || {});
        let best = null;
        (lines || []).slice(0, opts.maximumLines).forEach((line, lineIndex) => {
            const cells = lineCells(line, opts);
            const mapping = mapHeadersStrict(cells.map((cell) => cell.text));
            const mappedCount = mapping.filter((item) => item.field).length;
            const fields = new Set(mapping.filter((item) => item.field).map((item) => item.field));
            if (!(fields.has('code') || fields.has('title')) || mappedCount < opts.minimumMappedHeaders) return;
            if (!best || mappedCount > best.mappedCount) best = { lineIndex, cells, mapping, mappedCount };
        });
        return best;
    }

    function buildColumnsStrict(header) {
        const mapped = header.mapping.map((mapping, index) => ({
            field: mapping.field,
            original: mapping.original,
            x: header.cells[index].x,
            end: header.cells[index].end
        })).filter((column) => column.field).sort((a, b) => a.x - b.x);
        const boundaries = [];
        for (let index = 0; index < mapped.length - 1; index += 1) {
            const current = mapped[index];
            const next = mapped[index + 1];
            const openGap = next.x - current.end;
            boundaries.push(openGap > 0 ? current.end + openGap / 2 : (current.x + next.x) / 2);
        }
        return mapped.map((column, index) => ({
            field: column.field,
            original: column.original,
            x: column.x,
            end: column.end,
            left: index === 0 ? -Infinity : boundaries[index - 1],
            right: index === mapped.length - 1 ? Infinity : boundaries[index]
        }));
    }

    function appendCell(target, field, item) {
        if (!target[field]) {
            target[field] = item.text;
            target.__lastItems[field] = item;
            return;
        }
        const previous = target.__lastItems[field];
        const gap = item.x - (previous.x + previous.width);
        const spacer = gap > 1.5 && !/\s$/.test(target[field]) && !/^\s/.test(item.text) ? ' ' : '';
        target[field] += spacer + item.text;
        target.__lastItems[field] = item;
    }

    function assignLineStrict(line, columns, options) {
        const opts = Object.assign({ boundaryTolerance: 2 }, options || {});
        const values = Object.fromEntries((columns || []).map((column) => [column.field, '']));
        values.__lastItems = {};
        const issues = [];
        (line && line.items || []).slice().sort((a, b) => a.x - b.x).forEach((item) => {
            const left = Number(item.x || 0);
            const right = left + Number(item.width || 0);
            const center = left + Number(item.width || 0) / 2;
            const column = columns.find((candidate) => center >= candidate.left && center < candidate.right);
            if (!column) {
                issues.push({ code: 'UNASSIGNED_TEXT', text: item.text, x: left });
                return;
            }
            const tolerance = Math.max(opts.boundaryTolerance, Number(item.height || 10) * 0.2);
            const crossesLeft = Number.isFinite(column.left) && left < column.left - tolerance;
            const crossesRight = Number.isFinite(column.right) && right > column.right + tolerance;
            if (crossesLeft || crossesRight) {
                issues.push({
                    code: 'CROSS_COLUMN_TEXT',
                    field: column.field,
                    text: item.text,
                    x: left,
                    end: right,
                    leftBoundary: column.left,
                    rightBoundary: column.right
                });
            }
            appendCell(values, column.field, item);
        });
        delete values.__lastItems;
        Object.keys(values).forEach((field) => { values[field] = normalization.normalizeInlineText(values[field]); });
        return { values, issues };
    }

    function validateName(field, value) {
        if (!value) return [];
        const issues = [];
        if (/@|\bline\s*id\b|https?:|\d{5,}/i.test(value)) issues.push({ code: 'INVALID_CONTACT_NAME', field, value });
        if (normalization.normalizeInlineText(value).length < 2) issues.push({ code: 'TRUNCATED_CONTACT_NAME', field, value });
        return issues;
    }

    function validateCriticalFields(values) {
        const issues = [];
        issues.push(...validateName('pi', values.pi));
        issues.push(...validateName('nurse', values.nurse));
        if (values.phone) {
            const digits = values.phone.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 16 || /@/.test(values.phone)) issues.push({ code: 'INVALID_PHONE', field: 'phone', value: values.phone });
        }
        if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
            issues.push({ code: 'INVALID_EMAIL', field: 'email', value: values.email });
        }
        if (values.lineId) {
            const cleaned = values.lineId.replace(/^line\s*id\s*[:：]?\s*/i, '');
            if (!/^[A-Za-z0-9._-]{3,50}$/.test(cleaned)) issues.push({ code: 'INVALID_LINE_ID', field: 'lineId', value: values.lineId });
            else values.lineId = cleaned;
        }
        ['enrolledCount', 'targetCount', 'remainingSlots'].forEach((field) => {
            if (values[field] && !/^\d+$/.test(values[field])) issues.push({ code: 'INVALID_INTEGER', field, value: values[field] });
        });
        return issues;
    }

    function appendContinuationStrict(target, values, issues) {
        Object.entries(values).forEach(([field, value]) => {
            if (!value) return;
            if (!target[field]) {
                target[field] = value;
                return;
            }
            if (CRITICAL_FIELDS.has(field)) {
                issues.push({ code: 'CRITICAL_FIELD_WRAPPED', field, existing: target[field], continuation: value });
                return;
            }
            if (target[field] !== value) target[field] += `\n${value}`;
        });
    }

    function extractPdfTableRecordsStrict(pages, options) {
        const opts = Object.assign({ minimumRecords: 1 }, options || {});
        const records = [];
        const pageDiagnostics = [];
        (pages || []).forEach((page) => {
            const header = findHeaderLineStrict(page.lines, opts);
            if (!header) {
                pageDiagnostics.push({ pageNumber: page.pageNumber, tableDetected: false, recordCount: 0, issueCount: 0 });
                return;
            }
            const columns = buildColumnsStrict(header);
            const hasCodeColumn = columns.some((column) => column.field === 'code');
            let current = null;
            let currentIssues = [];
            let pageRecordCount = 0;

            function finishCurrent() {
                if (!current) return;
                currentIssues.push(...validateCriticalFields(current));
                current._parseIssues = currentIssues;
                current._requiresReview = currentIssues.some((issue) => CRITICAL_FIELDS.has(issue.field) || ['CROSS_COLUMN_TEXT', 'CRITICAL_FIELD_WRAPPED'].includes(issue.code));
                records.push(current);
                current = null;
                currentIssues = [];
            }

            page.lines.slice(header.lineIndex + 1).forEach((line, rowOffset) => {
                const assigned = assignLineStrict(line, columns, opts);
                const values = assigned.values;
                const repeated = mapHeadersStrict(Object.values(values)).filter((item) => item.field).length >= 2;
                if (!Object.values(values).some(Boolean) || repeated) return;
                const hasIdentity = hasCodeColumn ? Boolean(normalization.normalizeCode(values.code)) : Boolean(values.title);
                if (hasIdentity) {
                    finishCurrent();
                    current = Object.assign({}, values, {
                        source: {
                            type: 'pdf-table',
                            sourceId: `page-${page.pageNumber}-row-${rowOffset + 1}`,
                            pageNumber: page.pageNumber,
                            rowNumber: rowOffset + 1
                        }
                    });
                    currentIssues = assigned.issues.slice();
                    pageRecordCount += 1;
                } else if (current) {
                    currentIssues.push(...assigned.issues);
                    appendContinuationStrict(current, values, currentIssues);
                }
            });
            finishCurrent();
            const pageRecords = records.filter((record) => record.source && record.source.pageNumber === page.pageNumber);
            pageDiagnostics.push({
                pageNumber: page.pageNumber,
                tableDetected: true,
                mappedHeaderCount: header.mappedCount,
                columns: columns.map((column) => column.field),
                recordCount: pageRecordCount,
                issueCount: pageRecords.reduce((sum, record) => sum + (record._parseIssues || []).length, 0),
                reviewCount: pageRecords.filter((record) => record._requiresReview).length
            });
        });
        return {
            records,
            diagnostics: {
                mode: records.length >= opts.minimumRecords ? 'strict-table' : 'document',
                recordCount: records.length,
                reviewCount: records.filter((record) => record._requiresReview).length,
                pages: pageDiagnostics
            }
        };
    }

    function enforcePdfFieldIntegrity(result, options) {
        if (!result || !result.raw || !Array.isArray(result.raw.pages)) return result;
        const strict = extractPdfTableRecordsStrict(result.raw.pages, options);
        result.diagnostics = Object.assign({}, result.diagnostics, { fieldIntegrity: strict.diagnostics });
        if (strict.diagnostics.mode === 'strict-table') {
            result.records = strict.records;
            result.diagnostics.extractionMode = 'strict-table';
        }
        return result;
    }

    function enforceImportReview(plan) {
        if (!plan || !Array.isArray(plan.actions)) return plan;
        plan.actions.forEach((action) => {
            const raw = action.candidate && action.candidate.raw;
            if (!raw || !raw._requiresReview) return;
            action.type = 'review';
            action.reasons = (action.reasons || []).concat((raw._parseIssues || []).map((issue) => ({
                code: issue.code,
                field: issue.field || '',
                message: `PDF 欄位完整性需確認：${issue.field || issue.code}`
            })));
        });
        plan.summary = plan.actions.reduce((counts, action) => {
            counts[action.type] = (counts[action.type] || 0) + 1;
            return counts;
        }, { total: plan.actions.length, add: 0, update: 0, unchanged: 0, review: 0, invalid: 0, duplicate_in_file: 0 });
        return plan;
    }

    return {
        EXTRA_HEADERS,
        CRITICAL_FIELDS,
        mapHeadersStrict,
        findHeaderLineStrict,
        buildColumnsStrict,
        assignLineStrict,
        validateCriticalFields,
        appendContinuationStrict,
        extractPdfTableRecordsStrict,
        enforcePdfFieldIntegrity,
        enforceImportReview
    };
});
