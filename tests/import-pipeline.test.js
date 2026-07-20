'use strict';

const assert = require('assert');
const pipeline = require('../js/parsing/import-pipeline.js');

const existing = [
    { code: 'EX-001', title: 'Existing gastric study', sponsor: 'A', cancerType: 'gastric cancer' },
    { code: 'UNCHANGED-001', title: 'Same study', sponsor: 'B' }
];
const incoming = [
    { code: 'NEW-001', title: 'First-line HCC study', status: 'Recruiting' },
    { code: 'EX-001', title: 'Existing gastric study', sponsor: 'A', nurse: 'Nurse C' },
    { code: 'UNCHANGED-001', title: 'Same study', sponsor: 'B' },
    { code: 'CONFLICT-001', title: 'First version' },
    { code: 'CONFLICT-001', title: 'Second version' },
    { title: 'No code but stable source', sourceId: 'row-99' }
];
const plan = pipeline.planImport(incoming, existing);
assert.strictEqual(plan.summary.add, 3);
assert.strictEqual(plan.summary.update, 1);
assert.strictEqual(plan.summary.unchanged, 1);
assert.strictEqual(plan.summary.duplicate_in_file, 1);
assert.strictEqual(plan.summary.total, 6);
const updateAction = plan.actions.find((action) => action.type === 'update');
assert.strictEqual(updateAction.proposed.contacts.nurse, 'Nurse C');
const newAction = plan.actions.find((action) => action.type === 'add' && action.candidate.trial.code === 'NEW-001');
assert.strictEqual(newAction.candidate.trial.cancerTypes[0].type, '肝細胞癌');
assert.strictEqual(newAction.candidate.trial.treatmentLines.includes('1L'), true);
assert.strictEqual(newAction.candidate.trial.status, 'recruiting');
const applied = pipeline.applyImportPlan(existing, plan);
assert.strictEqual(applied.some((trial) => trial.code === 'NEW-001'), true);
assert.strictEqual(applied.find((trial) => trial.code === 'EX-001').contacts.nurse, 'Nurse C');
const registry = pipeline.createParserRegistry();
registry.register('mock', (input) => ({ records: input }));
assert.deepStrictEqual(registry.names(), ['mock']);
assert.deepStrictEqual(registry.parse('mock', [{ code: 'A' }]).records, [{ code: 'A' }]);
console.log('import-pipeline.test.js: all tests passed');
