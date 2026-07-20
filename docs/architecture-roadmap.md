# Architecture roadmap

## Layer 1: raw extraction

Preserve PDF text items, coordinates, page dimensions, XLSX cells, and source metadata without clinical interpretation.

## Layer 2: candidate detection

Detect candidate protocol codes, titles, criteria, cancer terms, treatment lines, biomarkers, investigators, nurses, and enrollment status.

## Layer 3: classification

Convert candidates into structured concepts with evidence, rule identifiers, role/context, and confidence.

## Layer 4: normalization and validation

Normalize trial schema, identify conflicts, retain original evidence, and flag uncertain classifications for review.

## Layer 5: import review

Show proposed additions, updates, skips, conflicts, and parser evidence before persistence.

## Layer 6: repository interface

The UI should use a stable trial repository API instead of knowing whether data comes from local storage or a future hospital API.

## Layer 7: search and presentation

Combine structured clinical filters with weighted free-text search. Every structured match should be explainable to the user.

## Planned sequence

1. Search/classification contract and HER2 tests.
2. Shared text segmentation and evidence model.
3. Cancer type and treatment-line classifiers.
4. Protocol code and people/status classifiers.
5. PDF/XLSX parser adapters.
6. Import review model.
7. Repository interface.
8. UI component split and usability improvements.
