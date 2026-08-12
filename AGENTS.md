# Project agent context

Resolve this project with `agentctl context --format env` before context-sensitive work.
- Scope: personal
- Git provider: github
- Issue tracker: linear
- VPN: tailscale profile=personal mode=on-demand

## Git workflow

- Work directly on the `main` branch for this repository.
- Do not create or use feature branches or Git worktrees.
- Keep implementation history incremental: make small, cohesive atomic commits throughout the work, after validating each completed unit in proportion to its risk.
- Do not combine unrelated changes in one commit, and preserve any pre-existing user changes that are outside the current task.
