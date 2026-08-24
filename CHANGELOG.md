# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-08-24

### Added
- Optional `serviceType` field on `ServiceConfig` — set it in `herdy-service.yaml` to override the name-derived type

### Changed
- `herdy status` columns are now derived dynamically from actual service names in the workspace instead of being filtered from a fixed `SERVICE_TYPES` list; any suffix after the last `-` becomes a column, sorted alphabetically
- `deriveServiceType()` replaces `getServiceType()` — respects explicit `serviceType` when set, otherwise falls back to the last dash-segment of the service name

## [0.3.0] - 2026-08-21

### Added
- `herdy config validate` — checks herdy.yaml for syntax errors and required fields (nodeVersion, baseBranch, repos, tracks) with colored pass/fail output
- `getCommitInfo()` in git core — fetches commit hash, date, and subject for any ref
- `scanWorkspaceLocal()` in workspace core — scans repos without requiring a fully initialised workspace
- `resolveConfigPath()` exported from workspace-config for external use
- `preversion` npm hook that auto-generates CHANGELOG entries via Claude before each release

### Changed
- YAML parse errors now include line/column position and actionable hints (colon-in-value, tab indentation, duplicate key)
- `status` columns adjusted for better truncation and readability
- `switch`, `update`, `install`, `start` commands pick up workspace-config improvements

## [0.2.0] - 2026-08-13

### Added
- `herdy config` — read and update workspace configuration keys from herdy.yaml via the CLI
- `herdy config set <key> <value>` — update a settable config key in-place
- `herdy config list` — display all current configuration values

## [0.1.3] - 2026-08-12

### Added
- examples/herdy.yaml for quick reference

### Fixed
- `herdy start` now detects `[nodemon] app crashed` in stdout and surfaces it as an error
- Status table repo/branch columns truncated to prevent layout overflow
- nanoid < 3.3.17 high-severity vulnerability patched

### Changed
- Upgrade vitest ^1.6.0 → ^4.1.10 to resolve esbuild/vite vulnerability chain
- Exclude `.claude/` from vitest test discovery

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
