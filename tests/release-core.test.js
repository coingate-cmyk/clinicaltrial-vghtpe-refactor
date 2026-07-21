'use strict';
const assert = require('assert');
const release = require('../js/core/release-core.js');

function createStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
}

const storage = createStorage();
storage.setItem(release.TRIAL_KEY, JSON.stringify([{ code: 'A-001', title: 'A' }]));
assert.strictEqual(release.readTrials(storage)[0].code, 'A-001');
release.writeTrials([{ code: 'B-002', title: 'B' }], { storage, snapshotReason: 'test write' });
assert.strictEqual(release.readTrials(storage)[0].code, 'B-002');
assert.strictEqual(release.readSnapshot(storage).trials[0].code, 'A-001');
release.restoreSnapshot(storage);
assert.strictEqual(release.readTrials(storage)[0].code, 'A-001');
assert.strictEqual(release.readSnapshot(storage).trials[0].code, 'B-002');

const session = createStorage();
assert.strictEqual(release.isManagerSessionActive(session), false);
release.setManagerSession(true, session);
assert.strictEqual(release.isManagerSessionActive(session), true);
release.setManagerSession(false, session);
assert.strictEqual(release.isManagerSessionActive(session), false);

console.log('release-core.test.js passed');
