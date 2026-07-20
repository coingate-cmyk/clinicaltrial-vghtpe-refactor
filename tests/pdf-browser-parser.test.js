'use strict';

const assert = require('assert');
const parser = require('../js/parsing/pdf-browser-parser.js');

function item(str, x, y, width) {
    return { str, transform: [1, 0, 0, 10, x, y], width: width || str.length * 5, height: 10 };
}

const layout = parser.reconstructTextItems([
    item('Protocol Number:', 10, 700, 80), item('ABC-080', 100, 700, 45),
    item('Official Title:', 10, 680, 70),
    item('First-line HCC Study', 10, 660, 105)
]);
assert.strictEqual(layout.text.includes('Protocol Number: ABC-080'), true);
assert.strictEqual(layout.text.includes('First-line HCC Study'), true);

const fakePdfJs = {
    getDocument() {
        return {
            promise: Promise.resolve({
                numPages: 1,
                getPage: async () => ({
                    getTextContent: async () => ({ items: [
                        item('Protocol Number:', 10, 700, 80), item('ABC-080', 100, 700, 45),
                        item('Official Title:', 10, 680, 70),
                        item('First-line HCC Study', 10, 660, 105),
                        item('Recruitment Status:', 10, 640, 100),
                        item('Recruiting', 10, 620, 55),
                        item('Inclusion Criteria:', 10, 600, 90),
                        item('No prior systemic therapy', 10, 580, 130)
                    ] })
                }),
                destroy: async () => {}
            })
        };
    }
};

(async () => {
    const parsed = await parser.parsePdfArrayBuffer(new Uint8Array([1, 2, 3]), { sourceName: 'synthetic.pdf' }, fakePdfJs);
    assert.strictEqual(parsed.format, 'pdf');
    assert.strictEqual(parsed.diagnostics.pageCount, 1);
    assert.strictEqual(parsed.records[0].code, 'ABC-080');
    assert.strictEqual(parsed.records[0].title, 'First-line HCC Study');
    assert.strictEqual(parsed.records[0].statusRaw, 'Recruiting');
    assert.strictEqual(parsed.raw.pages[0].lines.length >= 4, true);
    console.log('pdf-browser-parser.test.js: all tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
