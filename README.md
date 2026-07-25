# herdy

CLI tool to manage multi-service local development environments. Herd your microservices.

Designed for teams running multiple repos with interconnected services (APIs, cron jobs, message queues, web apps) that need to be built and started in dependency order.

## Install

```bash
npm install -g herdy
```

## Quick Start

**Existing workspace (repos already cloned):**

```bash
cd ~/projects/my-workspace
herdy link          # detect existing repos, show status
herdy start         # build and start all services
```

**Fresh setup:**

```bash
mkdir ~/projects/my-workspace && cd $_
# create herdy.yaml (see Configuration below)
herdy init          # clone all repos, install deps, build
herdy start         # start all services
```

## Commands

| Command | Description |
|---------|-------------|
| `herdy init` | Clone repos, install, build. Resumes if interrupted. `--force` to redo. |
| `herdy link [path]` | Point CLI at existing workspace directory |
| `herdy start [targets...]` | Start services. Specify repo/track names or omit to start all. |
| `herdy stop [service]` | Stop services (all or specific) |
| `herdy restart <target> [-b]` | Restart a service, repo, or group. `--build` to rebuild first. |
| `herdy switch <track>` | Switch active track |
| `herdy update [repos...] [--base]` | Pull latest, reinstall, rebuild. Defaults to current branch. |
| `herdy status` | Show status of all repos and services |
| `herdy logs <service> [-f]` | Tail logs for a service |
| `herdy logs --all` | View all service logs in tmux split panes |
| `herdy install [repo]` | Reinstall/rebuild a specific repo or all |

## Usage Examples

```bash
# Start common services in one terminal
herdy start

# Start a specific track in another terminal
herdy start my-track

# Check status from any terminal
herdy status

# Update a specific repo and restart it
herdy update auth-service
herdy restart auth-service

# Update all common repos to base branch
herdy update --base

# Switch between tracks
herdy switch web
herdy switch mobile

# View all logs in tmux
herdy logs --all

# Tail a single service
herdy logs auth-api -f
```

## Status Output

```
  Herdy    Active Track: web

  Repo              Branch        Sync            Dirty Built api     web     cron    mq      ws
  ──────────────────────────────────────────────────────────────────────────────────────────────
  common-lib        development   ✓ up to date    -     ✓     -       -       -       -       -
  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
  auth-service      development   ↓ 3 behind      -     ✓     up      up      up      -       -
  file-service      development   ✓ up to date    -     ✓     up      -       -       -       -
  messaging         development   ✓ up to date    -     ✓     up      -       -       up      -
  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
  web-app           feature/xyz   ✓ up to date    ✎     ✓     up      up      up      up      up

  up=running  off=stopped  err=error  build=building  -=N/A
```

**Columns:**
- **Sync** — commits behind base branch (`? offline` if fetch failed)
- **Dirty** — `✎` = uncommitted changes, `-` = clean
- **Built** — `✓` = built at current commit, `✗` = not built, `~` = partially built
- **Service types** — detected from name suffix (`-api`, `-web`, `-cron`, `-mq`, `-ws`)

## Configuration

### Workspace config (`herdy.yaml`)

Place in your workspace root. Defines repos, tracks, and shared settings.

```yaml
nodeVersion: "18"
baseBranch: development

repos:
  - name: common-lib
    url: git@github.com:myorg/common-lib.git
    group: foundation

  - name: auth-service
    url: git@github.com:myorg/auth-service.git
    group: common

  - name: web-app
    url: git@github.com:myorg/web-app.git
    group: track
    track: web

tracks:
  - name: web
    label: Web Frontend
  - name: mobile
    label: Mobile BFF
```

**Repo groups:**
- `foundation` — built first, before everything else (shared libraries)
- `common` — core services needed by all tracks
- `track` — project-specific services, only started when track is active

### Per-repo config (`herdy-service.yaml`)

Place in the root of each service repo. Defines sub-services and their relationships.

```yaml
services:
  - path: my-common
    name: my-common
    startScript: null
    dependsOn: []

  - path: my-backend
    name: my-backend
    startScript: null
    dependsOn: ["my-common"]

  - path: my-api
    name: my-api
    mode: dev
    devScript: "start:local:nodemon"
    dependsOn: ["my-backend"]

  - path: my-web
    name: my-web
    startScript: "start:local"
    dependsOn: ["my-backend"]
```

Without this config, herdy auto-discovers subdirectories with `package.json`.

**Fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `path` | (required) | Subdirectory within the repo |
| `name` | (required) | Display name (suffix determines type: `-api`, `-web`, `-cron`, `-mq`, `-ws`) |
| `startScript` | `start` | npm script to run. Set to `null` for build-only libraries. |
| `buildScript` | `build` | npm script to build |
| `devScript` | `start:dev` | npm script for dev mode (hot reload) |
| `mode` | `prod` | `prod` uses startScript, `dev` uses devScript |
| `dependsOn` | `[]` | Service names that must build before this one |

## How It Works

**Build order:** foundation → common → track, respecting `dependsOn` within each group.

**Smart rebuilds:** Herdy tracks the git commit SHA at build time. On next start/update, it skips rebuilding if the SHA hasn't changed.

**Process management:** `herdy start` stays running and manages child processes. Ctrl+C stops all services gracefully. Run multiple `herdy start` commands in separate terminals for different service groups.

**State persistence:** Service status (pid, port, running/error) is written to `~/.herdy/state.json`. `herdy status` reads this from any terminal and verifies PIDs are alive.

**Logs:** Written to `~/.herdy/logs/<service>.log`. `herdy logs --all` opens tmux with `tail -F` on each log file.

**Update flow:**
1. `git fetch`
2. Discard `package-lock.json` changes (regenerated by install)
3. Stash remaining changes if dirty
4. Checkout target branch (only with `--base` or `--branch`)
5. `git pull --rebase`
6. `npm install` + `npm run build` (skipped if SHA unchanged)

## Multi-workspace

Herdy supports multiple workspaces on the same machine. Each workspace is identified by its path and stored independently in `~/.herdy/state.json`.

```bash
# Workspace 1
cd ~/projects/workspace-a && herdy link

# Workspace 2
cd ~/projects/workspace-b && herdy link

# herdy uses the workspace where herdy.yaml is found (cwd or last used)
```

## Platform Support

- **macOS** — native
- **Linux** — native
- **Windows** — via WSL2 (full support including tmux)

## Requirements

- Node.js 18+
- Git
- tmux (optional, for `herdy logs --all`)

## License

MIT
