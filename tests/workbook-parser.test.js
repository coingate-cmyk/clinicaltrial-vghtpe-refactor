'use strict';
const assert = require('assert');
const parser = require('../js/parsing/xlsx-browser-parser.js');
const fileParser = require('../js/parsing/file-parser.js');

const matrix = [
  ['Synthetic workbook'],
  ['study code', 'study title', 'cancer type', 'line', 'status'],
  ['BOOK-080', 'First-line HCC study', 'HCC', '1L', 'Recruiting'],
  ['BOOK-081', 'Second-line BTC study', 'BTC', '2L', 'Closed']
];
const workbook = { SheetNames: ['Studies'], Sheets: { Studies: { matrix } } };
const fakeXlsx = { read: () => workbook, utils: { sheet_to_json: (sheet) => sheet.matrix } };
const header = parser.findHeaderRow(matrix);
assert.strictEqual(header.index, 1);
assert.strictEqual(header.mappedCount, 5);
const result = parser.parseWorkbook(workbook, fakeXlsx, { sourceName: 'synthetic.xlsx' });
assert.strictEqual(result.records.length, 2);
assert.strictEqual(result.records[0].code, 'BOOK-080');
assert.strictEqual(result.records[0].source.sheetName, 'Studies');
assert.strictEqual(result.diagnostics.sheets[0].headerRow, 2);
assert.strictEqual(fileParser.detectFileFormat({ name: 'study.xlsx', type: '' }, 'auto'), 'spreadsheet');
assert.strictEqual(fileParser.detectFileFormat({ name: 'protocol.pdf', type: '' }, 'auto'), 'pdf');
(async () => {
  const file = { name: 'synthetic.xlsx', type: '', arrayBuffer: async () => new ArrayBuffer(8) };
  const parsed = await parser.parseSpreadsheetFile(file, {}, fakeXlsx);
  assert.strictEqual(parsed.records[1].code, 'BOOK-081');
  console.log('workbook-parser.test.js: all tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
