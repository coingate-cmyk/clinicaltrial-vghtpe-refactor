'use strict';

const assert = require('assert');
const search = require('../js/search/search-engine.js');

const trials = [
    { code: 'CLDN-POS', inclusion: 'CLDN18.2 positive with membranous staining in at least 75% of tumor cells.' },
    { code: 'CLDN-EXCLUDED', inclusion: 'Advanced gastric cancer.', exclusion: 'CLDN18.2-positive disease is excluded.' },
    { code: 'MSI-H', inclusion: 'MSI-H or dMMR solid tumor is required.' },
    { code: 'MSS', inclusion: 'MSS and pMMR colorectal cancer.' },
    { code: 'KRAS-G12C', inclusion: 'KRAS G12C mutation confirmed by central testing.' },
    { code: 'KRAS-WT', inclusion: 'KRAS wild-type colorectal cancer.' },
    { code: 'BRAF-EXCLUDED', inclusion: 'Metastatic colorectal cancer.', exclusion: 'BRAF V600E mutation is excluded.' },
    { code: 'FGFR2B-POS', inclusion: 'FGFR2b-positive gastric cancer by central IHC.' },
    { code: 'CPS-10', inclusion: 'PD-L1 CPS >= 10 is required.' },
    { code: 'CPS-1', inclusion: 'PD-L1 CPS >= 1 is required.' }
];

assert.strictEqual(search.parseSearchQuery('CLDN18.2+ gastric').freeText, 'gastric');
assert.strictEqual(search.parseSearchQuery('MSI-H/dMMR').filters[0].status, 'deficient');
assert.strictEqual(search.parseSearchQuery('MSS/pMMR').filters[0].status, 'proficient');
assert.strictEqual(search.parseSearchQuery('PD-L1 CPS>=5').filters[0].threshold, 5);

assert.deepStrictEqual(search.searchTrials(trials, 'CLDN18.2+').map((item) => item.trial.code), ['CLDN-POS']);
assert.deepStrictEqual(search.searchTrials(trials, 'MSI-H/dMMR').map((item) => item.trial.code), ['MSI-H']);
assert.deepStrictEqual(search.searchTrials(trials, 'MSS/pMMR').map((item) => item.trial.code), ['MSS']);
assert.deepStrictEqual(search.searchTrials(trials, 'KRAS G12C').map((item) => item.trial.code), ['KRAS-G12C']);
assert.deepStrictEqual(search.searchTrials(trials, 'KRAS WT').map((item) => item.trial.code), ['KRAS-WT']);
assert.deepStrictEqual(search.searchTrials(trials, 'BRAF V600E').map((item) => item.trial.code), []);
assert.deepStrictEqual(search.searchTrials(trials, 'FGFR2b+').map((item) => item.trial.code), ['FGFR2B-POS']);
assert.deepStrictEqual(search.searchTrials(trials, 'PD-L1 CPS>=5').map((item) => item.trial.code), ['CPS-10']);

console.log('advanced-search.test.js: all tests passed');
