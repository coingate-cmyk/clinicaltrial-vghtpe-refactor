# Clinical Trial VGH-TPE Refactor

Public-safe workspace for rebuilding the clinical-trial parsing, classification, search, and review system.

The repository starts with a synthetic-data browser demo and an independent HER2 search core. It is designed to let us restructure the legacy application without changing the working production site.

## Priorities

1. Separate PDF/XLSX extraction from clinical classification.
2. Preserve evidence, source field, context, rule, and confidence for inferred values.
3. Replace substring-only search with clinically meaningful structured search.
4. Keep persistence behind a stable repository interface.
5. Migrate in reversible stages with regression tests.

## Browser demo

Open `index.html` directly in a browser. The demo contains synthetic examples only.

Try:

- `HER2` — any HER2 mention
- `HER2+` — explicitly eligible HER2-positive population
- `HER2 negative` — explicitly eligible HER2-negative population
- `HER2 low` — explicitly eligible HER2-low population
- `HER2 non-positive` — negative/low population or explicit exclusion of HER2-positive disease

Each result displays the evidence and context that caused the match.

## Tests

```bash
npm test
```

No package installation is required. The tests use Node's built-in assertion library.

## Current structure

```text
index.html                         Synthetic-data search demo
js/search/biomarker-classifier.js HER2 context and status classification
js/search/search-engine.js        Structured query parsing and ranking
tests/search-core.test.js         Regression tests
docs/architecture-roadmap.md      Refactor layers and sequence
docs/search-semantics.md          Search behavior contract
scripts/integrate_search_core.py  Temporary legacy-app integration helper
```

## Target structure

```text
js/
├─ core/
├─ classification/
├─ parsing/
├─ search/
├─ repositories/
└─ ui/
```

Only synthetic or fully de-identified fixtures should be committed to this public repository. Internal source files and deployment configuration stay outside this project.
