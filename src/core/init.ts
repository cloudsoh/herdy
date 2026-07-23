import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadWorkspaceConfig } from '../config/workspace-config.js';
import { loadState, saveState } from '../config/state.js';
import * as git from './git.js';
import { installService, buildService, copyEnvExample } from './service.js';
import type { InitProgress, RepoConfig } from '../types.js';

export interface InitCallbacks {
  onRepoStart: (repoName: string, step: string) => void;
  onRepoComplete: (repoName: string, step: string) => void;
  onRepoError: (repoName: string, step: string, error: string) => void;
  onProgress: (completed: number, total: number) => void;
}

export async function initWorkspace(
  workspacePath: string,
  force: boolean,
  callbacks: InitCallbacks
): Promise<void> {
  const config = loadWorkspaceConfig();
  const state = loadState();
  state.workspacePath = workspacePath;

  const totalSteps = config.repos.length * 4; // clone, env, install, build
  let completedSteps = 0;

  for (const repo of config.repos) {
    const repoPath = resolve(workspacePath, repo.name);
    const progress = state.initProgress[repo.name] || {
      cloned: false,
      installed: false,
      built: false,
      envCopied: false,
    };

    if (force) {
      progress.cloned = existsSync(resolve(repoPath, '.git'));
      progress.installed = false;
      progress.built = false;
      progress.envCopied = false;
    }

    // Clone
    if (!progress.cloned) {
      callbacks.onRepoStart(repo.name, 'cloning');
      try {
        await git.clone(repo.url, repoPath);
        progress.cloned = true;
        callbacks.onRepoComplete(repo.name, 'cloning');
      } catch (err: any) {
        callbacks.onRepoError(repo.name, 'cloning', err.message);
        state.initProgress[repo.name] = progress;
        saveState(state);
        continue;
      }
    }
    completedSteps++;
    callbacks.onProgress(completedSteps, totalSteps);

    // Checkout base branch for foundation and common services
    if (repo.group === 'foundation' || repo.group === 'common') {
      try {
        await git.checkout(config.baseBranch, repoPath);
      } catch {
        // may already be on the branch
      }
    }

    // Copy .env.example for each sub-service
    if (!progress.envCopied) {
      callbacks.onRepoStart(repo.name, 'copying .env');
      const entries = readdirSync(repoPath).filter((e) => {
        const p = resolve(repoPath, e);
        return existsSync(resolve(p, 'package.json'));
      });
      for (const entry of entries) {
        copyEnvExample(resolve(repoPath, entry));
      }
      progress.envCopied = true;
      callbacks.onRepoComplete(repo.name, 'copying .env');
    }
    completedSteps++;
    callbacks.onProgress(completedSteps, totalSteps);

    // Install
    if (!progress.installed || force) {
      callbacks.onRepoStart(repo.name, 'installing');
      try {
        const entries = getServiceDirs(repoPath);
        for (const entry of entries) {
          await installService(resolve(repoPath, entry));
        }
        progress.installed = true;
        callbacks.onRepoComplete(repo.name, 'installing');
      } catch (err: any) {
        callbacks.onRepoError(repo.name, 'installing', err.message);
        state.initProgress[repo.name] = progress;
        saveState(state);
        continue;
      }
    }
    completedSteps++;
    callbacks.onProgress(completedSteps, totalSteps);

    // Build
    if (!progress.built || force) {
      callbacks.onRepoStart(repo.name, 'building');
      try {
        const entries = getServiceDirs(repoPath);
        for (const entry of entries) {
          await buildService(resolve(repoPath, entry));
        }
        progress.built = true;
        callbacks.onRepoComplete(repo.name, 'building');
      } catch (err: any) {
        callbacks.onRepoError(repo.name, 'building', err.message);
        state.initProgress[repo.name] = progress;
        saveState(state);
        continue;
      }
    }
    completedSteps++;
    callbacks.onProgress(completedSteps, totalSteps);

    state.initProgress[repo.name] = progress;
    saveState(state);
  }
}

function getServiceDirs(repoPath: string): string[] {
  return readdirSync(repoPath).filter((entry) => {
    const entryPath = resolve(repoPath, entry);
    return existsSync(resolve(entryPath, 'package.json'));
  });
}
