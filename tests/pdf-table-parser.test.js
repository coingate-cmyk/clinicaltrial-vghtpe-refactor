'use strict';
const assert = require('assert');
const parser = require('../js/parsing/pdf-table-parser.js');
function item(text, x, width) { return { text, x, width: width || text.length * 5, height: 10 }; }
function line(y, items) { return { y, text: items.map((entry) => entry.text).join(' '), items }; }
const pages = [{
  pageNumber: 1,
  lines: [
    line(700, [item('Study Code', 10, 55), item('Study Title', 120, 60), item('Cancer Type', 310, 65), item('Line', 430, 25), item('Status', 500, 35)]),
    line(680, [item('TAB-080', 10, 45), item('First-line HCC study', 120, 100), item('HCC', 310, 20), item('1L', 430, 12), item('Recruiting', 500, 50)]),
    line(660, [item('with additional cohort details', 120, 135)]),
    line(640, [item('TAB-081', 10, 45), item('Second-line BTC study', 120, 105), item('BTC', 310, 20), item('2L', 430, 12), item('Closed', 500, 35)])
  ]
}];
const header = parser.findHeaderLine(pages[0].lines);
assert.strictEqual(header.mappedCount, 5);
const extracted = parser.extractPdfTableRecords(pages);
assert.strictEqual(extracted.diagnostics.mode, 'table');
assert.strictEqual(extracted.records.length, 2);
assert.strictEqual(extracted.records[0].code, 'TAB-080');
assert.strictEqual(extracted.records[0].title.includes('additional cohort details'), true);
assert.strictEqual(extracted.records[1].statusRaw, 'Closed');
const enhanced = parser.enhancePdfResult({ records: [{ code: 'SINGLE' }], diagnostics: {}, raw: { pages } });
assert.strictEqual(enhanced.records.length, 2);
assert.strictEqual(enhanced.diagnostics.extractionMode, 'table');
console.log('pdf-table-parser.test.js: all tests passed');
