# Security policy

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities or accidentally
exposed credentials. Use GitHub's private vulnerability reporting for this
repository:

https://github.com/nodelike/cueflow/security/advisories/new

Include the affected component, reproduction steps, potential impact, and any
suggested mitigation. Do not include real OAuth tokens, private playlists,
database contents, or full-track audio in the report.

## Supported versions

Cueflow is currently pre-release software. Security fixes are made on the
latest `main` revision; no released version line has a separate support window
yet.

## Security boundaries

Cueflow is designed to bind its local HTTP services to loopback, store OAuth
tokens in the operating system's credential store, and keep source playlists
read-only. Reports that show those boundaries can be bypassed are especially
valuable.
