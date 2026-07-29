# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-07-25

### Changed
- Updated package metadata and author info

## [0.1.0] - 2026-07-23

### Added
- `herdy init` — clone repos, install deps, build in dependency order; resumes if interrupted
- `herdy link` — point CLI at an existing workspace directory
- `herdy start` — build and start services in dependency order (foundation → common → track)
- `herdy stop` — stop all or specific services
- `herdy restart` — restart a service, repo, or group; `--build` to rebuild first
- `herdy switch` — switch active track
- `herdy update` — pull latest, reinstall, rebuild; `--base` to target base branch
- `herdy status` — dashboard showing branch, sync, dirty, built state, and service status per repo
- `herdy logs` — tail logs for a service; `--all` opens tmux split panes
- `herdy install` — reinstall/rebuild a specific repo or all
- SHA-based smart rebuilds (skip rebuild if commit unchanged)
- Per-repo config via `herdy-service.yaml` with auto-discovery fallback
- Dev mode support (`mode: dev` / `devScript`) for hot-reload workflows
- Multi-workspace support (workspaces keyed by path in `~/.herdy/state.json`)
- Git integration: fetch, pull --rebase, stash dirty changes, branch tracking
- tmux log viewer (`herdy logs --all`)
- Test suite (35 tests, vitest)
