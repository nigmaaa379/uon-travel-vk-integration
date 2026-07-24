# Security policy

## Reporting a vulnerability

Do not publish suspected vulnerabilities, credentials, tokens, personal data, screenshots of `.env`, server logs, or production database records in a public issue.

Report privately to the repository owner. Include the affected component, reproduction steps with test data only, impact, and a suggested fix. Revoke any exposed credential immediately instead of waiting for triage.

## Supported version

Only the current `main` branch and the currently deployed production revision receive security fixes.

## Security expectations

- Secrets exist only in the server-side `.env` and must never be committed.
- Production is served through HTTPS by a reverse proxy; port 3000 is bound to loopback only.
- Admin credentials, webhook secrets, API keys, and the consent HMAC secret must be unique random values and rotated after any suspected disclosure.
- Backups containing personal data must be encrypted and access-controlled.
- Security updates and CodeQL findings must be reviewed before deployment.
