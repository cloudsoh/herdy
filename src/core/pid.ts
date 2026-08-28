import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const PID_DIR = resolve(homedir(), '.herdy', 'pids');

function ensurePidDir(): void {
  mkdirSync(PID_DIR, { recursive: true });
}

export function getPidDir(): string {
  return PID_DIR;
}

export function getPidPath(serviceName: string): string {
  return resolve(PID_DIR, `${serviceName}.pid`);
}

export function writePid(serviceName: string, pid: number): void {
  ensurePidDir();
  writeFileSync(getPidPath(serviceName), String(pid), 'utf-8');
}

export function readPid(serviceName: string): number | null {
  const path = getPidPath(serviceName);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function deletePid(serviceName: string): void {
  try {
    unlinkSync(getPidPath(serviceName));
  } catch {
    // already gone — ignore
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isServiceAlive(serviceName: string): boolean {
  const pid = readPid(serviceName);
  if (pid === null) return false;
  if (isPidAlive(pid)) return true;
  deletePid(serviceName); // stale — clean up
  return false;
}

export function listRunningServices(): string[] {
  if (!existsSync(PID_DIR)) return [];
  return readdirSync(PID_DIR)
    .filter((f) => f.endsWith('.pid'))
    .map((f) => f.slice(0, -4))
    .filter((name) => isServiceAlive(name));
}
