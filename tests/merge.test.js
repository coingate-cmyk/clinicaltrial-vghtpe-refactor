'use strict';

const assert = require('assert');
const normalization = require('../js/core/normalization.js');
const merge = require('../js/core/trial-merge.js');

const existing = normalization.normalizeTrial({
    code: 'MERGE-080',
    title: 'Existing title',
    cancerTypes: [{ type: '胃癌', lines: ['1L'] }],
    sponsor: 'Example Pharma',
    interventions: ['Drug A'],
    pi: 'Dr. A'
});
const incoming = normalization.normalizeTrial({
    code: 'MERGE-080',
    title: 'Existing title',
    cancerTypes: [{ type: 'gastric cancer', lines: ['metastatic'] }],
    sponsor: 'Example Pharma',
    interventions: ['Drug A', 'Drug B'],
    nurse: 'Nurse B'
});
const result = merge.mergeTrials(existing, incoming);
assert.strictEqual(result.conflicts.length, 0);
assert.deepStrictEqual(result.trial.interventions, ['Drug A', 'Drug B']);
assert.deepStrictEqual(result.trial.cancerTypes, [{ type: '胃癌/胃食道交界腺癌', lines: ['1L', 'metastatic'] }]);
assert.strictEqual(result.trial.contacts.pi, 'Dr. A');
assert.strictEqual(result.trial.contacts.nurse, 'Nurse B');
const conflict = merge.mergeTrials(existing, normalization.normalizeTrial({ code: 'MERGE-080', title: 'Different title' }));
assert.strictEqual(conflict.conflicts.some((item) => item.field === 'title'), true);
assert.strictEqual(conflict.trial.title, 'Existing title');
assert.throws(() => merge.mergeTrials(existing, normalization.normalizeTrial({ code: 'OTHER-001' })), (error) => error && error.code === 'IDENTITY_MISMATCH');
console.log('merge.test.js: all tests passed');
