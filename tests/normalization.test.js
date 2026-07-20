'use strict';

const assert = require('assert');
const normalization = require('../js/core/normalization.js');
const schema = require('../js/core/trial-schema.js');

assert.strictEqual(normalization.normalizeCode(' JUR - 053 - U '), 'JUR-053-U');
assert.strictEqual(normalization.normalizeCode('XXX-080'), 'XXX-080');
assert.strictEqual(normalization.compactCode('DS-8201-724'), 'DS8201724');
assert.strictEqual(normalization.normalizePhase('Phase III'), '3');
assert.strictEqual(normalization.normalizeEnrollmentStatus('停止收案'), 'closed');
assert.strictEqual(normalization.normalizeCancerLabel('metastatic colorectal cancer'), '大腸直腸癌');
assert.deepStrictEqual(normalization.normalizeList('A; B；A'), ['A', 'B']);

const trial = normalization.normalizeTrial({
    studyCode: ' abc - 001 ',
    studyTitle: '  First-line   gastric cancer  ',
    cancerType: 'gastric cancer',
    line: 'first-line',
    status: 'open to accrual',
    pi: 'Dr. A'
});
assert.strictEqual(trial.code, 'ABC-001');
assert.strictEqual(trial.id, 'trial:ABC001');
assert.strictEqual(trial.title, 'First-line gastric cancer');
assert.deepStrictEqual(trial.cancerTypes, [{ type: '胃癌/胃食道交界腺癌', lines: [] }]);
assert.deepStrictEqual(trial.treatmentLines, ['first-line']);
assert.strictEqual(trial.status, 'recruiting');
assert.strictEqual(trial.contacts.pi, 'Dr. A');
assert.strictEqual(schema.trialIdentityKey(trial), 'code:ABC001');

const validation = schema.validateTrial(trial);
assert.strictEqual(validation.valid, true);
assert.strictEqual(validation.warnings.length, 0);
const missing = schema.validateTrial(normalization.normalizeTrial({ title: 'Untitled code study' }));
assert.strictEqual(missing.valid, true);
assert.strictEqual(missing.warnings.some((item) => item.code === 'MISSING_CODE'), true);
console.log('normalization.test.js: all tests passed');
