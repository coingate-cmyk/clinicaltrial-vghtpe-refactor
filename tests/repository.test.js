'use strict';

const assert = require('assert');
const memory = require('../js/repositories/memory-repository.js');
const local = require('../js/repositories/local-storage-repository.js');

(async () => {
    const repository = memory.createMemoryRepository([{ code: 'MEM-001', title: 'Original' }]);
    let notifications = 0;
    const unsubscribe = repository.subscribe(() => { notifications += 1; });
    assert.strictEqual((await repository.list()).length, 1);
    assert.strictEqual((await repository.get('MEM-001')).title, 'Original');
    await repository.save({ code: 'MEM-001', title: 'Updated' });
    assert.strictEqual((await repository.get('MEM-001')).title, 'Updated');
    await repository.save({ code: 'MEM-002', title: 'Second' });
    assert.strictEqual((await repository.list()).length, 2);
    assert.strictEqual(await repository.remove('MEM-001'), true);
    assert.strictEqual(await repository.remove('MEM-404'), false);
    assert.strictEqual(notifications, 3);
    unsubscribe();

    const storageData = new Map();
    const storage = {
        getItem: (key) => storageData.has(key) ? storageData.get(key) : null,
        setItem: (key, value) => storageData.set(key, value)
    };
    const localRepository = local.createLocalStorageRepository({ key: 'test', storage });
    await localRepository.save({ code: 'LS-001', title: 'Stored' });
    assert.strictEqual(JSON.parse(storageData.get('test'))[0].code, 'LS-001');
    console.log('repository.test.js: all tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
