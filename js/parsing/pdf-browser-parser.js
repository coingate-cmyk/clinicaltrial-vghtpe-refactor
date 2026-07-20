(function (root, factory) {
    const documentApi = typeof module === 'object' && module.exports
        ? require('./document-text-parser.js')
        : (root.ClinicalTrialApp && root.ClinicalTrialApp.parsing) || {};
    const api = factory(documentApi);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.parsing = Object.assign(root.ClinicalTrialApp.parsing || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (documentApi) {
    'use strict';

    const PDFJS_VERSION = '6.1.200';
    const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;
    let pdfJsPromise = null;

    function loadPdfJs() {
        if (!pdfJsPromise) {
            pdfJsPromise = import(`${PDFJS_BASE}/build/pdf.min.mjs`).then((pdfjs) => {
                if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;
                return pdfjs;
            });
        }
        return pdfJsPromise;
    }

    function itemGeometry(item) {
        const transform = item && item.transform || [];
        return {
            text: String(item && item.str || ''),
            x: Number(transform[4] || 0),
            y: Number(transform[5] || 0),
            width: Number(item && item.width || 0),
            height: Math.abs(Number(item && item.height || transform[3] || 10)) || 10,
            hasEOL: Boolean(item && item.hasEOL)
        };
    }

    function reconstructTextItems(items, options) {
        const opts = Object.assign({ yTolerance: 2.5, minimumGap: 1.5 }, options || {});
        const geometries = (items || []).map(itemGeometry).filter((item) => item.text.trim());
        const lines = [];
        geometries.forEach((item) => {
            let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= opts.yTolerance);
            if (!line) {
                line = { y: item.y, items: [] };
                lines.push(line);
            }
            line.items.push(item);
        });
        lines.sort((a, b) => b.y - a.y);
        const normalizedLines = lines.map((line) => {
            line.items.sort((a, b) => a.x - b.x);
            let text = '';
            let previous = null;
            line.items.forEach((item) => {
                if (previous) {
                    const previousEnd = previous.x + previous.width;
                    const gap = item.x - previousEnd;
                    const adaptiveGap = Math.max(opts.minimumGap, Math.min(previous.height, item.height) * 0.18);
                    if (gap > adaptiveGap && !/\s$/.test(text) && !/^\s/.test(item.text)) text += ' ';
                }
                text += item.text;
                previous = item;
            });
            return { y: line.y, text: text.replace(/[\t ]+/g, ' ').trim(), items: line.items };
        }).filter((line) => line.text);
        return { text: normalizedLines.map((line) => line.text).join('\n'), lines: normalizedLines, itemCount: geometries.length };
    }

    async function parsePdfArrayBuffer(arrayBuffer, options, pdfjsOverride) {
        const opts = options || {};
        const pdfjs = pdfjsOverride || await loadPdfJs();
        const loadingTask = pdfjs.getDocument({
            data: arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer),
            cMapUrl: `${PDFJS_BASE}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
            useSystemFonts: true
        });
        const pdf = await loadingTask.promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const reconstructed = reconstructTextItems(content.items, opts.layout);
            pages.push({ pageNumber, text: reconstructed.text, lines: reconstructed.lines, itemCount: reconstructed.itemCount });
        }
        if (typeof pdf.destroy === 'function') await pdf.destroy();
        const combinedText = pages.map((page) => page.text).filter(Boolean).join('\n\n');
        const parsed = documentApi.parseDocumentText(combinedText, { sourceType: 'pdf', sourceName: opts.sourceName || '', sourceId: opts.sourceId || '' });
        return {
            format: 'pdf',
            records: parsed.records,
            diagnostics: Object.assign({}, parsed.diagnostics, {
                pageCount: pages.length,
                extractedItemCount: pages.reduce((sum, page) => sum + page.itemCount, 0),
                extractedCharacterCount: combinedText.length
            }),
            raw: { pages, text: combinedText }
        };
    }

    async function parsePdfFile(file, options, pdfjsOverride) {
        if (!file || typeof file.arrayBuffer !== 'function') throw new TypeError('A File-like object with arrayBuffer() is required.');
        return parsePdfArrayBuffer(await file.arrayBuffer(), Object.assign({}, options, { sourceName: (options && options.sourceName) || file.name || '' }), pdfjsOverride);
    }

    return { PDFJS_VERSION, PDFJS_BASE, loadPdfJs, itemGeometry, reconstructTextItems, parsePdfArrayBuffer, parsePdfFile };
});