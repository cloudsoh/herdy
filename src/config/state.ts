import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { WorkspaceState, GlobalState } from '../types.js';

const STATE_DIR = resolve(homedir(), '.herdy');
const STATE_FILE = resolve(STATE_DIR, 'state.json');

const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  workspacePath: '',
  activeTrack: undefined,
  initProgress: {},
  services: {},
  builds: {},
  lastUpdated: new Date().toISOString(),
};

const DEFAULT_GLOBAL_STATE: GlobalState = {
  workspaces: {},
  lastUsed: '',
};

function loadGlobalState(): GlobalState {
  if (!existsSync(STATE_FILE)) {
    return { ...DEFAULT_GLOBAL_STATE };
  }
  const raw = readFileSync(STATE_FILE, 'utf-8');
  const parsed = JSON.parse(raw);

  // Migrate from old single-workspace format
  if (parsed.workspacePath && !parsed.workspaces) {
    const migrated: GlobalState = {
      workspaces: { [parsed.workspacePath]: parsed },
      lastUsed: parsed.workspacePath,
    };
    saveGlobalState(migrated);
    return migrated;
  }

  return parsed as GlobalState;
}

function saveGlobalState(global: GlobalState): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(global, null, 2));
}

export function resolveWorkspacePath(): string {
  // 1. If cwd has herdy.yaml, use cwd
  const cwdConfig = resolve(process.cwd(), 'herdy.yaml');
  if (existsSync(cwdConfig)) {
    return process.cwd();
  }

  // 2. Fall back to lastUsed
  const global = loadGlobalState();
  return global.lastUsed || '';
}

export function loadState(): WorkspaceState {
  const workspacePath = resolveWorkspacePath();
  if (!workspacePath) {
    return { ...DEFAULT_WORKSPACE_STATE };
  }

  const global = loadGlobalState();
  const state = global.workspaces[workspacePath] || { ...DEFAULT_WORKSPACE_STATE, workspacePath };
  if (!state.builds) state.builds = {};
  return state;
}

export function saveState(state: WorkspaceState): void {
  state.lastUpdated = new Date().toISOString();
  const global = loadGlobalState();
  global.workspaces[state.workspacePath] = state;
  global.lastUsed = state.workspacePath;
  saveGlobalState(global);
}

// Serializes concurrent updateServiceState calls so concurrent service startups
// don't overwrite each other's state in the read-modify-write cycle.
let writeQueue: Promise<void> = Promise.resolve();

export function updateServiceState(
  serviceName: string,
  update: Partial<WorkspaceState['services'][string]>
): void {
  writeQueue = writeQueue.then(() => {
    const workspacePath = resolveWorkspacePath();
    if (!workspacePath) return;

    const global = loadGlobalState();
    if (!global.workspaces[workspacePath]) {
      global.workspaces[workspacePath] = { ...DEFAULT_WORKSPACE_STATE, workspacePath };
    }
    const ws = global.workspaces[workspacePath];
    if (!ws.services) ws.services = {};
    ws.services[serviceName] = {
      ...ws.services[serviceName],
      ...update,
    } as WorkspaceState['services'][string];
    ws.lastUpdated = new Date().toISOString();
    saveGlobalState(global);
  }).catch(() => {});
}

export function listWorkspaces(): { path: string; lastUpdated: string }[] {
  const global = loadGlobalState();
  return Object.entries(global.workspaces).map(([path, ws]) => ({
    path,
    lastUpdated: ws.lastUpdated,
  }));
}

export function getStatePath(): string {
  return STATE_FILE;
}
