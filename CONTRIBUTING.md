# Contributing to Cueflow

Thanks for helping improve Cueflow. Bug reports, focused feature proposals,
documentation fixes, and tested code changes are welcome.

## Before opening a change

1. Search the GitHub issues and open an issue for substantial behavior or data
   model changes before investing in an implementation.
2. Keep changes focused. Avoid mixing generated files, formatting, dependency
   updates, and unrelated behavior in one pull request.
3. Never commit OAuth tokens, database dumps, full-track audio, `.env` files, or
   other private catalog data. Use synthetic fixtures in tests.
4. Preserve Cueflow's playlist safety contract: source playlists are read-only,
   and mutations are limited to Cueflow-owned output playlists.

## Development checks

Follow the setup in the README, then run:

```sh
make test
pnpm --dir frontend audit --audit-level high
pip-audit -r scripts/requirements.txt
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
make build
```

PostgreSQL-backed tests run when `DATABASE_URL` is set. Pull requests should add
or update tests for observable behavior and explain any check that cannot be run
locally.

By contributing, you agree that your contribution is licensed under the
project's MIT License.
