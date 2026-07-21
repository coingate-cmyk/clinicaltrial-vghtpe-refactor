# Privacy and Deployment Boundary

## Public GitHub Pages build

The public build is designed for code review, synthetic demonstrations, and single-browser local operation. Imported files are processed in the browser. Trial data is stored in browser local storage and is not intentionally uploaded by the application.

A local management session only enables write controls in the current browser tab. It is not authentication, authorization, encryption, or an institutional audit identity.

## Never commit

- Patient names, medical record numbers, national IDs, dates of birth, addresses, phone numbers, or free-text clinical notes.
- Internal staff contact lists copied from operational documents.
- Real Study Status PDFs, spreadsheets, protocol exports, or screenshots.
- Production Firebase configuration, shared passwords, private API tokens, or deployment secrets.

Only synthetic or fully de-identified fixtures may enter this public repository.

## Browser-local operational use

When using the static site with operational trial metadata:

1. Use an institution-managed device and browser profile.
2. Keep the device encrypted and protected by operating-system login.
3. Download versioned backups before imports or bulk edits.
4. Store backups only in approved institutional storage.
5. Review every PDF row flagged for split fields, cross-page content, ambiguous contacts, or missing identity.
6. Do not import patient-level data.
7. Clear browser data before transferring or retiring the device.

## Requirements for institutional multi-user deployment

A real shared production deployment needs a separate internal layer providing:

- Institutional authentication and role-based authorization.
- Server-side validation and protected write APIs.
- Central database backups, retention, and disaster recovery.
- User-attributed audit logs and immutable change history.
- Transport encryption and approved certificate/domain management.
- Security review, vulnerability management, and dependency governance.
- Data classification, access review, incident response, and off-boarding.

The UI's local management switch must not be represented as satisfying these requirements.

## Recommended architecture

Keep parser, classifier, search, and conflict-review modules browser-compatible and public-safe. Put identity, secrets, persistence, and institutional deployment configuration in a private internal repository or internal service. The browser should call only authenticated, authorized APIs in that deployment.
