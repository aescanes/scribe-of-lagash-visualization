# Security Policy

## Supported Versions

Only the latest published release is supported. Please update to the latest
version before reporting an issue.

## Reporting a Vulnerability

Please report vulnerabilities through GitHub by
[opening an issue](https://github.com/aescanes/scribe-of-lagash-visualization/issues/new)
in this repository, with a description of the issue and steps to reproduce it.
You should get a response within a few days.

If the issue is sensitive and you would rather not disclose it publicly, use
GitHub's [private vulnerability reporting](https://github.com/aescanes/scribe-of-lagash-visualization/security/advisories/new)
instead.

## Supply-chain posture

This project pins every dependency to an exact version (no `^`/`~` ranges,
no `latest`) and disables npm lifecycle scripts by default
(`ignore-scripts=true` in `.npmrc`) so that `npm install`/`npm ci` never runs
a dependency's `preinstall`/`install`/`postinstall` script automatically. See
the "Supply-chain safety" section of the README for details. If you believe
one of these protections has a gap, that's also welcome as a security report.
