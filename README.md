# herdy

CLI tool to manage multi-service local development environments. Herd your microservices.

## Install

```bash
npm install -g herdy
```

## Quick Start (existing workspace)

```bash
cd ~/projects/my-workspace
herdy link          # detect existing repos
herdy dev           # launch dashboard
```

## Fresh Setup

```bash
mkdir ~/projects/my-workspace && cd $_
# create herdy.yaml (see below)
herdy init          # clone all repos, install deps, build
herdy dev           # launch dashboard
```

## Commands

| Command | Description |
|---------|-------------|
| `herdy init` | Clone repos, install, build. Resumes if interrupted. `--force` to redo. |
| `herdy link [path]` | Point CLI at existing workspace directory |
| `herdy dev` | Launch TUI dashboard |
| `herdy start` | Start common services + active track |
| `herdy stop [service]` | Stop services (all or specific) |
| `herdy switch <track>` | Switch active track |
| `herdy update` | Pull latest dev branch for common repos, reinstall, rebuild |
| `herdy status` | Quick text-based status summary |
| `herdy logs <service>` | Tail logs for a service (`-f` to follow, `--all` for tmux) |
| `herdy install [repo]` | Reinstall/rebuild a specific repo or all |

## Dashboard Controls

- `↑↓` — Navigate repos
- `Enter` / `l` — View logs for selected service
- `r` — Refresh status
- `b` / `Esc` — Back to dashboard (from logs)
- `q` — Quit

## Configuration

### Workspace config (`herdy.yaml`)

Place in your workspace root. Defines repos, tracks, and shared settings.

```yaml
nodeVersion: "18"
developmentBranch: development

repos:
  - name: auth-service
    url: git@github.com:myorg/auth-service.git
    group: common
  - name: frontend-app
    url: git@github.com:myorg/frontend-app.git
    group: track
    track: web

tracks:
  - name: web
    label: Web Frontend
  - name: mobile
    label: Mobile BFF
```

### Per-repo config (`herdy-service.yaml`)

Place in the root of each service repo. Defines sub-services and their relationships.

```yaml
services:
  - path: auth-backend
    name: auth-api
    startScript: start
    buildScript: build
    hotReload: false
    dependsOn: []
  - path: auth-cron
    name: auth-cron
    startScript: start
    buildScript: build
    dependsOn: ["auth-api"]
```

Without this config, herdy auto-discovers subdirectories with `package.json`.

**Fields:**
- `path` — subdirectory within the repo
- `name` — display name (also determines type: suffix `-api`, `-web`, `-cron`, `-mq`, `-ws`)
- `startScript` — npm script to run (`null` for build-only libraries)
- `buildScript` — npm script to build
- `hotReload` — enable watch mode (default: false)
- `dependsOn` — service names that must build first

## Requirements

- Node.js 18+
- `n` (Node version manager)
- Git
- tmux (optional, for `herdy logs --all`)

## License

MIT
