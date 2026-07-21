(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
        const parsing = root.ClinicalTrialApp.parsing;
        if (typeof parsing.parsePdfFile === 'function' && !parsing.parsePdfFile.__contactHeuristics) {
            const originalFile = parsing.parsePdfFile;
            const wrappedFile = async function () {
                return api.enforceContactHeuristics(await originalFile.apply(this, arguments));
            };
            wrappedFile.__contactHeuristics = true;
            parsing.parsePdfFile = wrappedFile;
        }
        if (typeof parsing.parsePdfArrayBuffer === 'function' && !parsing.parsePdfArrayBuffer.__contactHeuristics) {
            const originalBuffer = parsing.parsePdfArrayBuffer;
            const wrappedBuffer = async function () {
                return api.enforceContactHeuristics(await originalBuffer.apply(this, arguments));
            };
            wrappedBuffer.__contactHeuristics = true;
            parsing.parsePdfArrayBuffer = wrappedBuffer;
        }
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function isCjk(value) {
        return /[\u3400-\u9FFF]/.test(String(value || ''));
    }

    function shortSingleEnglishToken(value) {
        const text = String(value || '').trim();
        return Boolean(text) && !isCjk(text) && /^[A-Za-z.'-]+$/.test(text) && text.length < 5;
    }

    function looksLikeNameFragment(value) {
        const text = String(value || '').trim();
        return /^[A-Za-z]{2,10}$/.test(text) && !/\d/.test(text);
    }

    function contactHeuristicIssues(record) {
        const item = record || {};
        const issues = [];
        ['pi', 'nurse'].forEach((field) => {
            if (shortSingleEnglishToken(item[field])) {
                issues.push({ code: 'POSSIBLE_TRUNCATED_CONTACT_NAME', field, value: item[field] });
            }
        });
        if (looksLikeNameFragment(item.lineId) && (shortSingleEnglishToken(item.nurse) || shortSingleEnglishToken(item.pi))) {
            issues.push({
                code: 'POSSIBLE_NAME_LINE_ID_SPLIT',
                field: 'lineId',
                value: item.lineId,
                relatedValue: item.nurse || item.pi || ''
            });
        }
        return issues;
    }

    function enforceContactHeuristics(result) {
        if (!result || !Array.isArray(result.records)) return result;
        result.records.forEach((record) => {
            const issues = contactHeuristicIssues(record);
            if (!issues.length) return;
            record._parseIssues = (record._parseIssues || []).concat(issues);
            record._requiresReview = true;
        });
        const reviewCount = result.records.filter((record) => record._requiresReview).length;
        result.diagnostics = Object.assign({}, result.diagnostics, {
            contactHeuristics: {
                reviewCount,
                issueCount: result.records.reduce((sum, record) => sum + (record._parseIssues || []).filter((issue) => /^POSSIBLE_/.test(issue.code)).length, 0)
            }
        });
        return result;
    }

    return { shortSingleEnglishToken, looksLikeNameFragment, contactHeuristicIssues, enforceContactHeuristics };
});
