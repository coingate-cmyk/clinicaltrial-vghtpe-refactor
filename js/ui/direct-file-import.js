(function (root) {
    'use strict';

    function byId(id) { return document.getElementById(id); }

    const currentScriptUrl = document.currentScript && document.currentScript.src;
    const moduleUrl = (relative) => currentScriptUrl
        ? new URL(relative, currentScriptUrl).href
        : `./js/${relative.replace(/^\.\.\//, '')}`;
    const integrityReady = import(moduleUrl('../parsing/pdf-field-integrity.js'))
        .then(() => import(moduleUrl('../parsing/pdf-contact-heuristics.js')))
        .catch((error) => {
            console.error('PDF integrity modules failed to load', error);
            return null;
        });

    async function handleBinaryFile(event) {
        const file = event.target && event.target.files && event.target.files[0];
        if (!file) return;
        const parsing = root.ClinicalTrialApp && root.ClinicalTrialApp.parsing;
        if (!parsing || typeof parsing.detectFileFormat !== 'function') return;
        const format = parsing.detectFileFormat(file, 'auto');
        if (!['pdf', 'spreadsheet'].includes(format)) return;

        event.stopImmediatePropagation();
        const status = byId('importStatus');
        const text = byId('importText');
        const formatSelect = byId('importFormat');
        const review = byId('reviewList');
        const applyButton = byId('applyImportButton');
        if (review) review.innerHTML = '';
        if (applyButton) applyButton.disabled = true;
        if (status) status.textContent = `正在本機解析 ${file.name}…`;

        try {
            if (format === 'pdf') await integrityReady;
            const parsed = await parsing.parseFile(file, { format });
            if (text) text.value = JSON.stringify(parsed.records, null, 2);
            if (formatSelect) formatSelect.value = 'json';
            const diagnostics = parsed.diagnostics || {};
            const integrity = diagnostics.fieldIntegrity || {};
            const contactHeuristics = diagnostics.contactHeuristics || {};
            const detail = format === 'pdf'
                ? `PDF ${diagnostics.pageCount || 0} 頁、擷取 ${diagnostics.extractedCharacterCount || 0} 字元`
                : `Excel ${diagnostics.sheetCount || 0} 個工作表`;
            const reviewCount = Math.max(integrity.reviewCount || 0, contactHeuristics.reviewCount || 0);
            const reviewText = format === 'pdf' && reviewCount
                ? `；其中 ${reviewCount} 筆因跨欄、截斷或聯絡欄位格式不完整，必須人工確認`
                : '';
            if (status) status.textContent = `${detail}，產生 ${parsed.records.length} 筆候選資料${reviewText}。請按「解析並比對」。`;
        } catch (error) {
            if (text) text.value = '';
            if (status) status.textContent = `檔案解析失敗：${error.message}`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const input = byId('importFile');
        if (input) input.addEventListener('change', handleBinaryFile, { capture: true });
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
