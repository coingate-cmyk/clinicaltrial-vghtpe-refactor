'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
    'search-core.test.js',
    'normalization.test.js',
    'classification.test.js',
    'document-parser.test.js',
    'delimited-parser.test.js',
    'merge.test.js',
    'import-pipeline.test.js',
    'repository.test.js'
];

let failed = false;
for (const test of tests) {
    const result = spawnSync(process.execPath, [path.join(__dirname, test)], { stdio: 'inherit' });
    if (result.status !== 0) failed = true;
}
if (failed) process.exitCode = 1;
else console.log(`All ${tests.length} test files passed.`);
