'use strict';

const assert = require('assert');
const parser = require('../js/parsing/document-text-parser.js');
const table = require('../js/parsing/table-parser-core.js');

const text = `
Protocol Number: ABC-080
Official Title:
A Phase III First-line Study in Gastric Cancer
Sponsor:
Example Pharma
Phase:
Phase III
Recruitment Status:
Recruiting
Inclusion Criteria:
HER2 positive by IHC 3+ or IHC 2+/ISH+
Measurable disease
Exclusion Criteria:
Prior anti-HER2 treatment
`;
const parsed = parser.parseDocumentText(text, { sourceName: 'synthetic.pdf' });
assert.strictEqual(parsed.records.length, 1);
assert.strictEqual(parsed.records[0].code, 'ABC-080');
assert.strictEqual(parsed.records[0].title, 'A Phase III First-line Study in Gastric Cancer');
assert.strictEqual(parsed.records[0].sponsor, 'Example Pharma');
assert.strictEqual(parsed.records[0].phase, 'Phase III');
assert.strictEqual(parsed.records[0].statusRaw, 'Recruiting');
assert.strictEqual(parsed.records[0].inclusion.includes('HER2 positive'), true);
assert.strictEqual(parsed.records[0].exclusion.includes('Prior anti-HER2'), true);
assert.strictEqual(parsed.diagnostics.codeDetected, true);

const headers = ['試驗代號', '試驗名稱', '癌別', '治療線別', '收案狀態', 'Unknown Col'];
const rows = [['TAB-001', 'First-line CRC trial', 'colorectal cancer', '1L', '可收案', 'ignore']];
const tabular = table.parseTable(headers, rows, { sourceName: 'synthetic.xlsx' });
assert.strictEqual(tabular.records[0].code, 'TAB-001');
assert.strictEqual(tabular.records[0].title, 'First-line CRC trial');
assert.strictEqual(tabular.records[0].cancerType, 'colorectal cancer');
assert.strictEqual(tabular.diagnostics.mappedHeaders.length, 5);
assert.strictEqual(tabular.diagnostics.unmappedHeaders.length, 1);
console.log('document-parser.test.js: all tests passed');
