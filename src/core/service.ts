import { execa, type Subprocess } from 'execa';
import { resolve } from 'node:path';
import { existsSync, copyFileSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import treeKill from 'tree-kill';
import type { ServiceConfig, ServiceState, ServiceStatus } from '../types.js';
import { updateServiceState } from '../config/state.js';

const LOG_DIR = resolve(homedir(), '.herdy', 'logs');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

function getLogPath(serviceName: string): string {
  return resolve(LOG_DIR, `${serviceName}.log`);
}

function appendLog(serviceName: string, data: string) {
  ensureLogDir();
  appendFileSync(getLogPath(serviceName), data);
}

const PORT_REGEX = /port=(\d+)/;
const VITE_PORT_REGEX = /localhost:(\d+)/;
const READY_TIMEOUT_MS = 5000;
const NODEMON_CRASH_REGEX = /\[nodemon\] app crashed/;

interface ManagedService {
  process: Subprocess;
  config: ServiceConfig;
  state: ServiceState;
  logBuffer: string[];
}

const managedServices = new Map<string, ManagedService>();

export function getManagedServices(): Map<string, ManagedService> {
  return managedServices;
}

export function getServiceLogs(serviceName: string, lines = 100): string[] {
  // Try in-memory first (same process)
  const service = managedServices.get(serviceName);
  if (service) return service.logBuffer.slice(-lines);

  // Fall back to log file (cross-process)
  const logPath = getLogPath(serviceName);
  if (!existsSync(logPath)) return [];
  const content = readFileSync(logPath, 'utf-8');
  const allLines = content.split('\n');
  return allLines.slice(-lines);
}

export async function installService(servicePath: string): Promise<void> {
  await execa('npm', ['install'], { cwd: servicePath });
}

export async function buildService(servicePath: string, buildScript = 'build'): Promise<string> {
  const result = await execa('npm', ['run', buildScript], {
    cwd: servicePath,
    reject: false,
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || 'Build failed');
  }
  return result.stdout;
}

export function copyEnvExample(servicePath: string): boolean {
  const examplePath = resolve(servicePath, '.env.example');
  const envPath = resolve(servicePath, '.env');
  if (existsSync(examplePath) && !existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
    return true;
  }
  return false;
}

export async function startService(
  servicePath: string,
  config: ServiceConfig,
  repoName: string,
  onStatusChange?: (status: ServiceStatus, error?: string) => void
): Promise<ServiceState> {
  const script = config.mode === 'dev' ? config.devScript : config.startScript;
  if (!script) {
    throw new Error(`Service ${config.name} has no startScript (build-only library)`);
  }

  const serviceName = config.name;
  const fullPath = resolve(servicePath, config.path);

  let resolveReady: (state: ServiceState) => void;
  const ready = new Promise<ServiceState>((resolve) => { resolveReady = resolve; });

  const setState = (status: ServiceStatus, extra?: Partial<ServiceState>) => {
    const state: ServiceState = {
      name: serviceName,
      repoName,
      path: fullPath,
      status,
      ...extra,
    };
    updateServiceState(serviceName, state);
    onStatusChange?.(status, extra?.error);
    if (status === 'running' || status === 'error') resolveReady!(state);
    return state;
  };

  setState('starting');

  // Mark restart in log file (don't truncate — tail follow handles this)
  ensureLogDir();
  appendFileSync(getLogPath(serviceName), `\n--- [herdy] Service starting at ${new Date().toISOString()} ---\n`);

  const child = execa('npm', ['run', script], {
    cwd: fullPath,
    env: { ...process.env, FORCE_COLOR: '1' },
    reject: false,
  });

  const managed: ManagedService = {
    process: child,
    config,
    state: { name: serviceName, repoName, path: fullPath, status: 'starting' },
    logBuffer: [],
  };

  managedServices.set(serviceName, managed);

  // If service doesn't log a port, assume running after timeout
  const readyTimer = setTimeout(() => {
    if (managed.state.status === 'starting') {
      managed.state = setState('running', { pid: child.pid });
    }
  }, READY_TIMEOUT_MS);

  child.stdout?.on('data', (data: Buffer) => {
    const line = data.toString();
    managed.logBuffer.push(line);
    if (managed.logBuffer.length > 1000) {
      managed.logBuffer.shift();
    }
    appendLog(serviceName, line);

    if (NODEMON_CRASH_REGEX.test(line)) {
      clearTimeout(readyTimer);
      managed.state = setState('error', { error: 'App crashed — run: herdy logs ' + serviceName });
    } else if (managed.state.status === 'starting') {
      const portMatch = line.match(PORT_REGEX) || line.match(VITE_PORT_REGEX);
      if (portMatch) {
        clearTimeout(readyTimer);
        const port = parseInt(portMatch[1], 10);
        managed.state = setState('running', { pid: child.pid, port });
      }
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString();
    managed.logBuffer.push(line);
    if (managed.logBuffer.length > 1000) {
      managed.logBuffer.shift();
    }
    appendLog(serviceName, line);
  });

  child.on('exit', (code) => {
    clearTimeout(readyTimer);
    if (managed.state.status !== 'stopped') {
      const lastLines = managed.logBuffer.slice(-10).join('').trim();
      const errorMsg = `Exited with code ${code}`;
      managed.state = setState('error', { error: errorMsg });
      onStatusChange?.('error', `${errorMsg}\n${lastLines}`);
    }
    managedServices.delete(serviceName);
  });

  return ready;
}

export async function stopService(serviceName: string): Promise<void> {
  const managed = managedServices.get(serviceName);
  if (!managed) return;

  managed.state.status = 'stopped';
  updateServiceState(serviceName, { status: 'stopped' });

  if (managed.process.pid) {
    await new Promise<void>((resolve, reject) => {
      treeKill(managed.process.pid!, 'SIGTERM', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  managedServices.delete(serviceName);
}

export async function stopAllServices(): Promise<void> {
  const names = Array.from(managedServices.keys());
  await Promise.all(names.map(stopService));
}

export function isServiceRunning(serviceName: string): boolean {
  return managedServices.has(serviceName);
}
