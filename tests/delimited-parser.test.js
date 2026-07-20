'use strict';

const assert = require('assert');
const parser = require('../js/parsing/delimited-parser.js');

const csv = '試驗代號,試驗名稱,備註\nCSV-001,"First-line, gastric trial","Line 1\nLine 2"\n';
const parsedCsv = parser.parseDelimitedText(csv, { sourceName: 'test.csv' });
assert.strictEqual(parsedCsv.records.length, 1);
assert.strictEqual(parsedCsv.records[0].code, 'CSV-001');
assert.strictEqual(parsedCsv.records[0].title, 'First-line, gastric trial');
assert.strictEqual(parsedCsv.records[0].notes, 'Line 1\nLine 2');
assert.strictEqual(parsedCsv.diagnostics.delimiter, ',');

const tsv = '試驗代號\t試驗名稱\t癌別\nTSV-080\tHCC study\tHCC\n';
const parsedTsv = parser.parseDelimitedText(tsv, { sourceName: 'test.tsv' });
assert.strictEqual(parsedTsv.records[0].code, 'TSV-080');
assert.strictEqual(parsedTsv.diagnostics.delimiter, 'tab');
console.log('delimited-parser.test.js: all tests passed');
