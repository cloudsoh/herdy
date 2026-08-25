import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadWorkspaceConfig } from '../config/workspace-config.js';
import { loadState, saveState } from '../config/state.js';
import { discoverServices } from '../config/service-config.js';
import * as git from './git.js';
import type { RepoConfig, ServiceConfig, ServiceState, WorkspaceState, GitStatus } from '../types.js';

export interface RepoInfo {
  config: RepoConfig;
  path: string;
  exists: boolean;
  gitStatus?: GitStatus;
  services: ServiceConfig[];
}

export function scanWorkspaceLocal(workspacePath: string): RepoInfo[] {
  const config = loadWorkspaceConfig();
  const repos: RepoInfo[] = [];

  for (const repoConfig of config.repos) {
    const repoPath = resolve(workspacePath, repoConfig.name);
    const exists = existsSync(repoPath) && existsSync(resolve(repoPath, '.git'));
    const services = exists ? discoverServices(repoPath, repoConfig.name) : [];
    repos.push({ config: repoConfig, path: repoPath, exists, services });
  }

  return repos;
}

export async function scanWorkspace(workspacePath: string): Promise<RepoInfo[]> {
  const config = loadWorkspaceConfig();
  const repos: RepoInfo[] = [];

  for (const repoConfig of config.repos) {
    const repoPath = resolve(workspacePath, repoConfig.name);
    const exists = existsSync(repoPath) && existsSync(resolve(repoPath, '.git'));

    let gitStatus: GitStatus | undefined;
    if (exists) {
      try {
        gitStatus = await git.getStatus(repoPath, config.baseBranch, config.remote ?? 'origin');
      } catch {
        // ignore git errors for repos on different branches
      }
    }

    const services = exists ? discoverServices(repoPath, repoConfig.name) : [];

    repos.push({ config: repoConfig, path: repoPath, exists, gitStatus, services });
  }

  return repos;
}

export async function linkWorkspace(workspacePath: string): Promise<WorkspaceState> {
  const state = loadState();
  state.workspacePath = workspacePath;

  const repos = await scanWorkspace(workspacePath);
  for (const repo of repos) {
    if (repo.exists) {
      state.initProgress[repo.config.name] = {
        cloned: true,
        installed: existsSync(resolve(repo.path, 'node_modules')),
        built: hasBuildOutput(repo.path),
        envCopied: true,
      };
    }
  }

  saveState(state);
  return state;
}

function hasBuildOutput(repoPath: string): boolean {
  const entries = readdirSync(repoPath);
  for (const entry of entries) {
    const entryPath = resolve(repoPath, entry);
    if (statSync(entryPath).isDirectory()) {
      const distPath = resolve(entryPath, 'dist');
      if (existsSync(distPath)) return true;
    }
  }
  return false;
}

export function getServicesForGroup(
  repos: RepoInfo[],
  group: 'foundation' | 'common' | 'track',
  track?: string
): { repo: RepoInfo; service: ServiceConfig }[] {
  const result: { repo: RepoInfo; service: ServiceConfig }[] = [];
  for (const repo of repos) {
    if (repo.config.group !== group) continue;
    if (group === 'track' && track && repo.config.track !== track) continue;
    for (const service of repo.services) {
      result.push({ repo, service });
    }
  }
  return result;
}

export function topologicalSort(
  services: { repo: RepoInfo; service: ServiceConfig }[]
): { repo: RepoInfo; service: ServiceConfig }[][] {
  const serviceMap = new Map(services.map((s) => [s.service.name, s]));
  const visited = new Set<string>();
  const levels: { repo: RepoInfo; service: ServiceConfig }[][] = [];

  function getLevel(name: string, depth = 0): number {
    const entry = serviceMap.get(name);
    if (!entry) return 0;
    if (entry.service.dependsOn.length === 0) return 0;
    return Math.max(...entry.service.dependsOn.map((dep) => getLevel(dep, depth + 1))) + 1;
  }

  for (const entry of services) {
    const level = getLevel(entry.service.name);
    if (!levels[level]) levels[level] = [];
    levels[level].push(entry);
  }

  return levels.filter(Boolean);
}
