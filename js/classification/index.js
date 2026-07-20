(function (root, factory) {
    const cancer = typeof module === 'object' && module.exports ? require('./cancer-type.js') : root.ClinicalTrialApp.classification;
    const line = typeof module === 'object' && module.exports ? require('./treatment-line.js') : root.ClinicalTrialApp.classification;
    const status = typeof module === 'object' && module.exports ? require('./enrollment-status.js') : root.ClinicalTrialApp.classification;
    const api = factory(cancer, line, status);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.ClinicalTrialApp = root.ClinicalTrialApp || {};
        root.ClinicalTrialApp.classification = Object.assign(root.ClinicalTrialApp.classification || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (cancer, line, status) {
    'use strict';

    function classifyTrial(trial) {
        return {
            cancerTypes: cancer.classifyCancerTypes(trial),
            treatmentLines: line.classifyTreatmentLines(trial),
            enrollmentStatus: status.classifyEnrollmentStatus(trial)
        };
    }

    return { classifyTrial };
});