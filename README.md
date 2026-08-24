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
herdy update order-service
herdy restart order-service

# Update all common repos to base branch
herdy update --base

# Switch between tracks
herdy switch web
herdy switch mobile

# View all logs in tmux
herdy logs --all

# Tail a single service
herdy logs order-api -f
```

## Status Output

```
  Herdy    Active Track: web

  Repo              Branch        Sync            Dirty Built api     web     worker
  ────────────────────────────────────────────────────────────────────────────────
  shared-ui         main          ✓ up to date    -     ✓     -       -       -
  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
  product-service   main          ✓ up to date    -     ✓     up      -       -
  order-service     main          ↓ 2 behind      -     ✓     up      -       up
  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
  storefront        feature/cart  ✓ up to date    ✎     ✓     up      up      -

  up=running  off=stopped  err=error  build=building  -=N/A
```

**Columns:**
- **Sync** — commits behind base branch (`? offline` if fetch failed)
- **Dirty** — `✎` = uncommitted changes, `-` = clean
- **Built** — `✓` = built at current commit, `✗` = not built, `~` = partially built
- **Service columns** — auto-detected from the last segment of each service name (`order-api` → `api`, `order-worker` → `worker`). Override with `serviceType` in `herdy-service.yaml`.

## Configuration

### Workspace config (`herdy.yaml`)

Place in your workspace root. Defines repos, tracks, and shared settings.

```yaml
nodeVersion: "20"
baseBranch: main

repos:
  - name: shared-ui
    url: git@github.com:myorg/shared-ui.git
    group: foundation

  - name: product-service
    url: git@github.com:myorg/product-service.git
    group: common

  - name: order-service
    url: git@github.com:myorg/order-service.git
    group: common

  - name: storefront
    url: git@github.com:myorg/storefront.git
    group: track
    track: web

  - name: mobile-bff
    url: git@github.com:myorg/mobile-bff.git
    group: track
    track: mobile

tracks:
  - name: web
    label: Web Storefront
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
  - path: order-core
    name: order-core
    startScript: null
    dependsOn: []

  - path: order-api
    name: order-api
    mode: dev
    devScript: "start:dev"
    dependsOn: ["order-core"]

  - path: order-worker
    name: order-worker
    startScript: "start"
    dependsOn: ["order-core"]

  # Optional: explicit service type override
  - path: order-ws
    name: order-notifications
    serviceType: realtime
    startScript: "start"
    dependsOn: ["order-core"]
```

Without this config, herdy auto-discovers subdirectories with `package.json`.

**Fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `path` | (required) | Subdirectory within the repo |
| `name` | (required) | Display name. The last `-`-separated segment is used as the service type column in `herdy status` (e.g. `order-api` → `api`). |
| `startScript` | `start` | npm script to run. Set to `null` for build-only libraries. |
| `buildScript` | `build` | npm script to build |
| `devScript` | `start:dev` | npm script for dev mode (hot reload) |
| `mode` | `prod` | `prod` uses startScript, `dev` uses devScript |
| `dependsOn` | `[]` | Service names that must build before this one |
| `serviceType` | _(from name)_ | Override the service type column shown in `herdy status` |

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
