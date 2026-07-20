'use strict';
const assert = require('assert');
const normalization = require('../js/core/normalization.js');
const typeRules = require('../js/classification/' + 'cancer-type.js');
const lineRules = require('../js/classification/treatment-line.js');
const statusRules = require('../js/classification/enrollment-status.js');

const first = normalization.normalizeTrial({ code: 'T-001', title: 'First-line HCC study', status: 'Recruiting' });
assert.strictEqual(typeRules.classifyCancerTypes(first)[0].value, '肝細胞癌');
assert.strictEqual(lineRules.classifyTreatmentLines(first).some((item) => item.value === '1L'), true);
assert.strictEqual(statusRules.classifyEnrollmentStatus(first).value, 'recruiting');

const second = normalization.normalizeTrial({ code: 'T-002', title: 'Neoadjuvant ESCC study' });
assert.strictEqual(typeRules.classifyCancerTypes(second)[0].value, '食道鱗狀細胞癌');
assert.strictEqual(lineRules.classifyTreatmentLines(second).some((item) => item.value === 'neoadjuvant'), true);
console.log('clinical-rules.test.js: all tests passed');
