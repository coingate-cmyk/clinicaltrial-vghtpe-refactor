(function (root, factory) {
    const memoryApi = typeof module === 'object' && module.exports ? require('./memory-repository.js') : root.ClinicalTrialApp.repositories;
    const api = factory(memoryApi);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.repositories = Object.assign(root.ClinicalTrialApp.repositories || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (memoryApi) {
    'use strict';

    function createLocalStorageRepository(options) {
        const opts = Object.assign({ key: 'clinicaltrial-vghtpe-refactor.trials', storage: typeof localStorage !== 'undefined' ? localStorage : null }, options || {});
        if (!opts.storage) throw new Error('A Web Storage-compatible object is required.');
        let initial = [];
        try { initial = JSON.parse(opts.storage.getItem(opts.key) || '[]'); } catch (error) { initial = []; }
        const repository = memoryApi.createMemoryRepository(initial);
        repository.subscribe((trials) => opts.storage.setItem(opts.key, JSON.stringify(trials)));
        return repository;
    }

    return { createLocalStorageRepository };
});