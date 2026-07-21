'use strict';

const assert = require('assert');
const integrity = require('../js/parsing/pdf-field-integrity.js');

function item(text, x, width) {
    return { text, x, width: width == null ? text.length * 5 : width, height: 10 };
}

function line(y, items) {
    return { y, text: items.map((entry) => entry.text).join(' '), items };
}

function pageWithRows(rows) {
    return [{
        pageNumber: 1,
        lines: [
            line(700, [
                item('Study Code', 10, 55),
                item('Study Title', 110, 60),
                item('Study Nurse', 280, 65),
                item('LINE ID', 410, 45),
                item('Phone', 520, 35)
            ]),
            ...rows
        ]
    }];
}

const clean = integrity.extractPdfTableRecordsStrict(pageWithRows([
    line(680, [
        item('PDF-080', 10, 45),
        item('First-line gastric study', 110, 120),
        item('Amy Lin', 280, 52),
        item('amy.lin_080', 410, 65),
        item('02-12345678', 520, 62)
    ])
]));

assert.strictEqual(clean.records.length, 1);
assert.strictEqual(clean.records[0].nurse, 'Amy Lin');
assert.strictEqual(clean.records[0].lineId, 'amy.lin_080');
assert.strictEqual(clean.records[0]._requiresReview, false);
assert.deepStrictEqual(clean.records[0]._parseIssues, []);

const crossed = integrity.extractPdfTableRecordsStrict(pageWithRows([
    line(680, [
        item('PDF-081', 10, 45),
        item('Second-line gastric study', 110, 125),
        item('Amy Lin', 280, 105),
        item('amy081', 410, 45),
        item('02-87654321', 520, 62)
    ])
]));

assert.strictEqual(crossed.records.length, 1);
assert.strictEqual(crossed.records[0]._requiresReview, true);
assert.strictEqual(crossed.records[0]._parseIssues.some((issue) => issue.code === 'CROSS_COLUMN_TEXT'), true);

const wrapped = integrity.extractPdfTableRecordsStrict(pageWithRows([
    line(680, [
        item('PDF-082', 10, 45),
        item('Audit history study', 110, 100),
        item('Amy', 280, 25),
        item('amy082', 410, 45),
        item('02-22223333', 520, 62)
    ]),
    line(660, [item('Lin', 280, 18)])
]));

assert.strictEqual(wrapped.records[0]._requiresReview, true);
assert.strictEqual(wrapped.records[0]._parseIssues.some((issue) => issue.code === 'CRITICAL_FIELD_WRAPPED'), true);

const invalidLineId = integrity.extractPdfTableRecordsStrict(pageWithRows([
    line(680, [
        item('PDF-083', 10, 45),
        item('Contact validation study', 110, 115),
        item('Amy Lin', 280, 52),
        item('amy lin', 410, 50),
        item('02-33334444', 520, 62)
    ])
]));

assert.strictEqual(invalidLineId.records[0]._requiresReview, true);
assert.strictEqual(invalidLineId.records[0]._parseIssues.some((issue) => issue.code === 'INVALID_LINE_ID'), true);

const reviewedPlan = integrity.enforceImportReview({
    actions: [{
        type: 'add',
        candidate: { raw: crossed.records[0] }
    }]
});
assert.strictEqual(reviewedPlan.actions[0].type, 'review');
assert.strictEqual(reviewedPlan.summary.review, 1);
assert.strictEqual(reviewedPlan.summary.add, 0);

console.log('pdf-field-integrity.test.js: all tests passed');
