'use strict';

const assert = require('assert');
const extension = require('../js/parsing/availability-extension.js');
const search = require('../js/search/search-engine.js');

const trial = extension.attachAvailability({
    code: 'CONTACT-080',
    contacts: {
        pi: 'Dr. Chen',
        nurse: 'Amy Lin',
        phone: '02-12345678',
        email: 'amy@example.test'
    },
    status: 'recruiting',
    classifications: {}
}, {
    availability: '有名額',
    lineId: 'amy.lin_080'
});

assert.strictEqual(trial.contacts.lineId, 'amy.lin_080');
assert.strictEqual(trial.contacts.nurse, 'Amy Lin');
assert.strictEqual(trial.availability, 'available');

const results = search.searchTrials([trial], 'amy.lin_080');
assert.strictEqual(results.length, 1);
assert.strictEqual(results[0].trial.code, 'CONTACT-080');
assert.strictEqual(results[0].result.reasons[0].field, 'lineId');

console.log('contact-integrity.test.js: all tests passed');
