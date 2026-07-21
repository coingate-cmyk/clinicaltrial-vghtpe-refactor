# Release Checklist

## Code and data boundary

- [ ] Work is on a release or feature branch, not directly on `main`.
- [ ] No real PDF, spreadsheet, staff contact list, patient data, secret, password, token, or production configuration is committed.
- [ ] Only synthetic or fully de-identified fixtures are present.
- [ ] The original `clinicaltrialvghtpe` repository is unchanged.

## Regression testing

- [ ] `npm test` passes with Node.js 18 or later.
- [ ] Search regression cases pass, including HER2 mention/positive/negative/low/non-positive semantics.
- [ ] PDF field-integrity and contact-heuristic tests pass.
- [ ] Versioned backup, legacy restore, duplicate detection, snapshot, undo, and manager-session tests pass.
- [ ] Browser scripts pass syntax checking.

## Browser acceptance

- [ ] Default mode is read-only.
- [ ] Local management warning clearly states that it is not authentication.
- [ ] Add/edit/import/delete/restore/reset controls are hidden or blocked outside local management mode.
- [ ] Versioned backup downloads and restores correctly.
- [ ] Every write creates a recoverable local snapshot.
- [ ] Field-level conflicts show existing and incoming values.
- [ ] Protected fields cannot be accepted without an explicit resolution.
- [ ] PDF review rows are unchecked by default.
- [ ] LINE ID, original contact block, enrollment counts, verification date/user, and source page are visible in details.
- [ ] Renal, CTCAE, AJCC, and RECIST tools open without cross-repository dependencies.
- [ ] Mobile layout remains usable.

## Study Status PDF acceptance

Use an approved local test copy; never commit it.

- [ ] Expected trial count matches the source document.
- [ ] Wrapped or cross-page rows merge into one trial.
- [ ] Trial codes are not joined to neighboring rows.
- [ ] Multiple Study Nurses, phone numbers, extensions, and LINE IDs remain associated with the correct trial.
- [ ] Split Chinese names are reconstructed or held for review.
- [ ] Ambiguous contact blocks remain in `contacts.raw` and require review.
- [ ] Known trial-code and contact searches return the expected row after import.

## Merge and release

- [ ] Compare branch to `main` and inspect every changed path.
- [ ] Confirm no accidental sensitive strings are present.
- [ ] Open a pull request with release scope and limitations.
- [ ] Squash merge after verification.
- [ ] Re-fetch `main` and confirm version, index script order, release modules, and local tools.
- [ ] Confirm GitHub Pages updates to the release version.
- [ ] Record remaining institutional deployment requirements separately.
