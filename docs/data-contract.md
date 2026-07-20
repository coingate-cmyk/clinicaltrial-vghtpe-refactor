# Trial data contract

The refactor uses one normalized trial object between parsers, classifiers, search, repositories, and UI.

## Required principles

- Source text is preserved separately from derived classifications.
- Study codes keep leading zeroes and only normalize spacing/punctuation.
- A classifier returns value, confidence, rule identifier, and evidence.
- Import never writes directly. It first creates an add/update/unchanged/review/invalid plan.
- Conflicting non-empty values require review unless a field-specific policy explicitly resolves them.
- Public fixtures must be synthetic or fully de-identified.

## Main fields

```text
schemaVersion
id
code
title / shortTitle
sponsor / phase
status / statusRaw / active
cancerTypes[]
treatmentLines[]
biomarkers[]
inclusion / exclusion / summary
interventions[]
contacts
sites[]
notes
source
provenance[]
classifications
```

## Import review actions

- `add`: no existing identity match
- `update`: same identity and only non-conflicting additions
- `unchanged`: normalized content is equivalent
- `review`: conflicts, missing stable identity, or duplicate existing records
- `invalid`: schema validation failed
- `duplicate_in_file`: repeated identity inside one import source
