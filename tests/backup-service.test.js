'use strict';
const assert = require('assert');
const backup = require('../js/core/backup-service.js');

const envelope = backup.createBackupEnvelope([
    { code: 'syn-001', title: 'Synthetic trial', contacts: { lineId: 'demo_line' } }
], { exportedAt: '2026-07-21T00:00:00.000Z', reason: 'test' });

assert.strictEqual(envelope.schema, backup.BACKUP_SCHEMA);
assert.strictEqual(envelope.appVersion, '1.0.0');
assert.strictEqual(envelope.trialCount, 1);
assert.strictEqual(envelope.trials[0].code, 'SYN-001');
assert.strictEqual(backup.parseBackupEnvelope(JSON.stringify(envelope)).trialCount, 1);
assert.strictEqual(backup.parseBackupEnvelope([{ code: 'legacy-1' }]).trials[0].code, 'LEGACY-1');
assert.strictEqual(backup.validateBackupEnvelope(envelope).valid, true);
assert.strictEqual(backup.validateBackupEnvelope([{ code: 'DUP-1' }, { code: 'dup 1' }]).valid, false);
assert.throws(() => backup.parseBackupEnvelope({ trialCount: 2, trials: [{ code: 'A' }] }), /mismatch/);
assert.strictEqual(backup.backupFileName('2026-07-21T12:00:00Z'), 'clinical-trials-backup-2026-07-21.json');

console.log('backup-service.test.js passed');
