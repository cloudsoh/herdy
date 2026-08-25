import { Command } from 'commander';
import chalk from 'chalk';
import { loadWorkspaceConfig } from '../../config/workspace-config.js';
import { loadState } from '../../config/state.js';
import { scanWorkspaceLocal } from '../../core/workspace.js';
import { deriveServiceType } from '../../config/service-config.js';
import * as git from '../../core/git.js';

function truncPad(str: string, width: number): string {
  return str.length > width ? str.slice(0, width - 1) + '…' : str.padEnd(width);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const statusCommand = new Command('status')
  .description('Show quick status of all services')
  .action(async () => {
    const state = loadState();
    if (!state.workspacePath) {
      console.log(chalk.red('No workspace linked. Run `herdy link` or `herdy init` first.'));
      return;
    }

    const config = loadWorkspaceConfig();
    const repos = scanWorkspaceLocal(state.workspacePath);
    const persistedServices = state.services || {};

    const foundationRepos = repos.filter((r) => r.config.group === 'foundation' && r.exists);
    const commonRepos = repos.filter((r) => r.config.group === 'common' && r.exists);
    const trackRepos = repos.filter((r) => r.config.group === 'track' && r.exists);

    const allRepos = [...foundationRepos, ...commonRepos, ...trackRepos];

    // Derive columns from the actual service names present in the workspace
    const usedTypes = new Set<string>();
    for (const repo of allRepos) {
      for (const service of repo.services) {
        if (!service.startScript) continue;
        usedTypes.add(deriveServiceType(service));
      }
    }
    const columns = [...usedTypes].sort();

    const repoCol = 18;
    const branchCol = 14;
    const syncCol = 16;
    const dirtyCol = 6;
    const builtCol = 6;
    const typeCol = 8;
    const totalWidth = repoCol + branchCol + syncCol + dirtyCol + builtCol + columns.length * typeCol;

    // Print header immediately — before any git fetches
    console.log('');
    console.log(
      chalk.bold('  Herdy') +
      (state.activeTrack ? chalk.yellow(`    Active Track: ${state.activeTrack}`) : '')
    );
    console.log('');
    console.log(chalk.gray(
      '  ' +
      'Repo'.padEnd(repoCol) +
      'Branch'.padEnd(branchCol) +
      'Sync'.padEnd(syncCol) +
      'Dirty'.padEnd(dirtyCol) +
      'Built'.padEnd(builtCol) +
      columns.map((c) => c.padEnd(typeCol)).join('')
    ));
    console.log(chalk.gray('  ' + '─'.repeat(totalWidth)));

    // Render rows
    const errors: { name: string; error: string }[] = [];

    async function renderRepo(repo: typeof allRepos[number]) {
      // Fetch git status inline — row prints as soon as this resolves
      const gitStatus = await git.getStatus(repo.path, config.baseBranch, repo.config.remote ?? config.remote ?? 'origin').catch(() => undefined);

      const branch = gitStatus?.branch || '—';
      const behind = gitStatus?.behindCount || 0;
      const fetchFailed = gitStatus?.fetchFailed ?? true;

      let sync: string;
      if (fetchFailed) {
        sync = chalk.gray('? offline'.padEnd(syncCol));
      } else if (behind > 0) {
        sync = chalk.yellow(`↓ ${behind} behind`.padEnd(syncCol));
      } else {
        sync = chalk.green('✓ up to date'.padEnd(syncCol));
      }

      const dirty = gitStatus?.isDirty
        ? chalk.yellow('✎'.padEnd(dirtyCol))
        : chalk.gray('-'.padEnd(dirtyCol));

      // Built status — compare stored build commit vs current HEAD
      let builtDisplay: string;
      const currentCommit = await git.getCurrentCommit(repo.path).catch(() => '');
      const buildableServices = repo.services.filter((s) => s.buildScript);
      if (buildableServices.length === 0) {
        builtDisplay = chalk.gray('-'.padEnd(builtCol));
      } else {
        const buildStatuses = buildableServices.map((s) => {
          const buildKey = `${repo.config.name}/${s.path}`;
          const record = state.builds?.[buildKey];
          return record && record.commit === currentCommit;
        });
        const allBuilt = buildStatuses.every(Boolean);
        const noneBuilt = buildStatuses.every((b) => !b);
        if (allBuilt) {
          builtDisplay = chalk.green('✓'.padEnd(builtCol));
        } else if (noneBuilt) {
          builtDisplay = chalk.red('✗'.padEnd(builtCol));
        } else {
          builtDisplay = chalk.yellow('~'.padEnd(builtCol));
        }
      }

      const serviceStatuses = columns.map((type) => {
        const service = repo.services.find((s) => s.startScript && deriveServiceType(s) === type);
        if (!service) return chalk.gray('-'.padEnd(typeCol));

        // Read persisted service state
        const persisted = persistedServices[service.name];
        if (persisted) {
          const st = persisted.status;
          // Verify PID is actually alive for "running" services
          if (st === 'running' && persisted.pid) {
            if (isPidAlive(persisted.pid)) {
              return chalk.green('up'.padEnd(typeCol));
            }
            return chalk.red('dead'.padEnd(typeCol));
          }
          if (st === 'running') return chalk.green('up'.padEnd(typeCol));
          if (st === 'starting') return chalk.yellow('start'.padEnd(typeCol));
          if (st === 'building') return chalk.yellow('build'.padEnd(typeCol));
          if (st === 'error') {
            errors.push({ name: service.name, error: persisted.error || 'unknown' });
            return chalk.red('err'.padEnd(typeCol));
          }
        }
        return chalk.gray('off'.padEnd(typeCol));
      });

      console.log(
        '  ' +
        truncPad(repo.config.name, repoCol) +
        truncPad(branch, branchCol) +
        sync +
        dirty +
        builtDisplay +
        serviceStatuses.join('')
      );
    }

    for (const repo of foundationRepos) {
      await renderRepo(repo);
    }

    if (foundationRepos.length > 0 && commonRepos.length > 0) {
      console.log(chalk.gray('  ' + '┈'.repeat(totalWidth)));
    }

    for (const repo of commonRepos) {
      await renderRepo(repo);
    }

    if (trackRepos.length > 0) {
      console.log(chalk.gray('  ' + '┈'.repeat(totalWidth)));
      for (const repo of trackRepos) {
        await renderRepo(repo);
      }
    }

    // Errors
    if (errors.length > 0) {
      console.log(chalk.red('\n  Errors:'));
      for (const { name, error } of errors) {
        console.log(chalk.red(`    ${name}: ${error}`));
      }
    }

    // Legend
    console.log('');
    console.log(
      chalk.gray('  ') +
      chalk.green('up') + chalk.gray('=running  ') +
      chalk.gray('off') + chalk.gray('=stopped  ') +
      chalk.red('err') + chalk.gray('=error  ') +
      chalk.yellow('build') + chalk.gray('=building  ') +
      chalk.gray('-') + chalk.gray('=N/A')
    );
    console.log('');
  });
