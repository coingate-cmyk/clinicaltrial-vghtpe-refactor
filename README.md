# Clinical Trial VGH-TPE Operations Workspace

Version 1.0.0 is a public-safe, browser-based clinical-trial search and local operations workspace. It separates extraction, normalization, clinical classification, search, import review, persistence, and UI so the legacy application can be replaced in reversible stages.

## Formal release capabilities

- Structured search across trial code, cancer type, treatment line, sponsor, PI, research nurse, phone, email, LINE ID, eligibility text, and historical enrollment status.
- Clinically meaningful HER2 search semantics (`HER2`, `HER2+`, `HER2 negative`, `HER2 low`, `HER2 non-positive`).
- Local PDF/XLSX/JSON/CSV/text import with candidate review before writing.
- Dedicated Study Status PDF handling for cross-page rows, wrapped study codes, and complex contact blocks.
- Field-level conflict review. Protected operational fields require an explicit decision before replacement.
- Read-only mode by default. Add, edit, import, delete, restore, and reset actions require an explicit local management session.
- Versioned JSON backup, restore validation, automatic pre-write snapshots, and one-step local undo.
- Local clinical tools: renal function/BSA, CTCAE quick reference, AJCC staging, and RECIST/TLS calculator.

## Data and security model

This repository and GitHub Pages site are public. Only synthetic or fully de-identified fixtures may be committed.

The browser application stores imported data in the current browser's local storage. A local management session is a safety interlock for the UI; it is **not authentication**, does not identify a user, and does not provide multi-user access control. Do not treat the public site as an institutional production database.

For real multi-user deployment, authentication, authorization, audit logging, backups, and institutional storage must be provided by an internal deployment layer. See `docs/privacy-and-deployment.md`.

## Browser use

Open the GitHub Pages site or `index.html`. The default view is read-only and starts with synthetic examples. Enable the local management session only when you need to change data in that browser.

Before importing operational data:

1. Download a versioned backup.
2. Import the file and review candidate counts.
3. Inspect every item marked for manual review.
4. Resolve protected field conflicts explicitly.
5. Apply only selected rows.
6. Search several known trial codes and contacts after import.

## Tests

No package installation is required. With Node.js 18 or later:

```bash
npm test
```

The suite covers search semantics, normalization, clinical rules, parsers, merge/conflict behavior, repositories, PDF field integrity, contact heuristics, versioned backup, snapshots, and local management-session state.

## Architecture

```text
js/
├─ core/             schema, normalization, merge, backup and release services
├─ classification/   cancer type, treatment line, status and slot rules
├─ parsing/          document, table, PDF, spreadsheet and import pipeline
├─ search/           structured query parsing and ranking
├─ repositories/     memory and local-storage repositories
└─ ui/               browser workspace, formal review and release controls
```

## Release policy

Changes are developed on a branch, regression-tested, reviewed for accidental sensitive content, and squash-merged. The original `clinicaltrialvghtpe` repository remains independent and is not modified by this project.
