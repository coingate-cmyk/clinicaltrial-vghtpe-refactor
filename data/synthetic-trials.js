(function (root) {
    'use strict';
    root.ClinicalTrialSyntheticData = [
        {
            code: 'SYN-GC-HER2-001',
            title: 'First-line HER2-positive gastric or GEJ adenocarcinoma study',
            sponsor: 'Synthetic Pharma A', phase: '3', status: 'Recruiting', active: true,
            cancerType: 'gastric cancer', treatmentLines: ['1L', 'metastatic'],
            interventions: ['Example antibody', 'Chemotherapy'],
            inclusion: 'HER2-positive by IHC 3+ or IHC 2+/ISH+. Previously untreated metastatic disease.',
            exclusion: 'Prior anti-HER2 therapy is not allowed.',
            pi: 'Synthetic Investigator A', nurse: 'Synthetic Coordinator A',
            notes: 'Synthetic fixture for structured HER2-positive search.'
        },
        {
            code: 'SYN-GC-HER2NEG-002',
            title: 'First-line gastric study for HER2-negative disease',
            sponsor: 'Synthetic Pharma B', phase: '2', status: 'Recruiting', active: true,
            cancerType: 'gastric cancer', treatmentLines: ['1L', 'metastatic'],
            interventions: ['Example immunotherapy'],
            inclusion: 'HER2-negative gastric or GEJ adenocarcinoma. CPS 1 or greater.',
            pi: 'Synthetic Investigator B', nurse: 'Synthetic Coordinator B'
        },
        {
            code: 'SYN-GC-HER2LOW-003',
            title: 'HER2-low gastric antibody-drug conjugate study',
            sponsor: 'Synthetic Pharma C', phase: '2', status: 'Pending', active: true,
            cancerType: 'gastric cancer', treatmentLines: ['2L', 'later-line'],
            interventions: ['Example ADC'],
            inclusion: 'HER2-low defined as IHC 1+ or IHC 2+/ISH-negative.',
            exclusion: 'HER2 IHC 3+ disease is excluded.'
        },
        {
            code: 'SYN-CRC-EXCLUDE-004',
            title: 'Molecularly selected metastatic colorectal study',
            sponsor: 'Synthetic Pharma D', phase: '2', status: 'Recruiting', active: true,
            cancerType: 'colorectal cancer', treatmentLines: ['later-line', 'metastatic'],
            inclusion: 'RAS and BRAF wild-type metastatic colorectal disease.',
            exclusion: 'HER2-positive or HER2-amplified tumor is excluded.',
            interventions: ['Example targeted therapy']
        },
        {
            code: 'SYN-ESCC-005',
            title: 'Neoadjuvant immunotherapy for locally advanced ESCC',
            sponsor: 'Academic Synthetic Group', phase: '2', status: 'Recruiting', active: true,
            cancerType: 'ESCC', treatmentLines: ['neoadjuvant', 'locally-advanced'],
            interventions: ['Example checkpoint inhibitor', 'Chemotherapy'],
            inclusion: 'Resectable locally advanced esophageal squamous cell carcinoma.',
            pi: 'Synthetic Investigator C'
        },
        {
            code: 'SYN-HCC-006',
            title: 'First-line systemic treatment for unresectable HCC',
            sponsor: 'Synthetic Pharma E', phase: '3', status: 'Recruiting', active: true,
            cancerType: 'HCC', treatmentLines: ['1L', 'unresectable'],
            interventions: ['Example immunotherapy combination'],
            inclusion: 'Unresectable hepatocellular carcinoma with no prior systemic therapy.'
        },
        {
            code: 'SYN-BTC-007',
            title: 'Second-line targeted therapy in advanced biliary tract disease',
            sponsor: 'Synthetic Pharma F', phase: '2', status: 'Temporarily closed', active: false,
            cancerType: 'BTC', treatmentLines: ['2L', 'metastatic'],
            interventions: ['Example kinase inhibitor'],
            inclusion: 'Advanced biliary tract disease after one prior systemic regimen.'
        },
        {
            code: 'SYN-PDAC-008',
            title: 'Adjuvant treatment study after pancreatic resection',
            sponsor: 'Academic Synthetic Group', phase: '2/3', status: 'Recruiting', active: true,
            cancerType: 'pancreatic cancer', treatmentLines: ['adjuvant'],
            interventions: ['Example chemotherapy'],
            inclusion: 'Completely resected pancreatic ductal adenocarcinoma.'
        },
        {
            code: 'SYN-GIST-009',
            title: 'Later-line treatment for advanced GIST',
            sponsor: 'Synthetic Pharma G', phase: '2', status: 'Closed', active: false,
            cancerType: 'GIST', treatmentLines: ['later-line', 'metastatic'],
            interventions: ['Example kinase inhibitor'],
            inclusion: 'Advanced gastrointestinal stromal tumor after at least two prior therapies.'
        },
        {
            code: 'SYN-BASKET-010',
            title: 'Basket study in advanced solid tumors with selected alterations',
            sponsor: 'Synthetic Pharma H', phase: '1/2', status: 'Pending', active: true,
            cancerType: 'solid tumors', treatmentLines: ['later-line'],
            interventions: ['Example precision therapy'],
            inclusion: 'Advanced solid tumors with a prespecified genomic alteration. HER2 status is not required.'
        }
    ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
