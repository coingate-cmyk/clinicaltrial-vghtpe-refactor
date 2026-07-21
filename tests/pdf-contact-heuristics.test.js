'use strict';

const assert = require('assert');
const heuristics = require('../js/parsing/pdf-contact-heuristics.js');

const clean = heuristics.enforceContactHeuristics({
    records: [{ code: 'CLEAN', nurse: 'Amy Lin', lineId: 'amy.lin_080', _parseIssues: [], _requiresReview: false }],
    diagnostics: {}
});
assert.strictEqual(clean.records[0]._requiresReview, false);

const split = heuristics.enforceContactHeuristics({
    records: [{ code: 'SPLIT', nurse: 'Amy', lineId: 'Lin', _parseIssues: [], _requiresReview: false }],
    diagnostics: {}
});
assert.strictEqual(split.records[0]._requiresReview, true);
assert.strictEqual(split.records[0]._parseIssues.some((issue) => issue.code === 'POSSIBLE_NAME_LINE_ID_SPLIT'), true);
assert.strictEqual(split.diagnostics.contactHeuristics.reviewCount, 1);

const chineseName = heuristics.enforceContactHeuristics({
    records: [{ code: 'CJK', nurse: '王小明', lineId: 'amy080', _parseIssues: [], _requiresReview: false }],
    diagnostics: {}
});
assert.strictEqual(chineseName.records[0]._requiresReview, false);

console.log('pdf-contact-heuristics.test.js: all tests passed');
