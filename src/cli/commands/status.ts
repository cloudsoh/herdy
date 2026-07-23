import { Command } from 'commander';
import chalk from 'chalk';
import { loadState } from '../../config/state.js';
import { scanWorkspace, getServicesForGroup } from '../../core/workspace.js';
import { SERVICE_TYPES, getServiceType, type ServiceType } from '../../config/service-config.js';
import * as git from '../../core/git.js';

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

    const repos = await scanWorkspace(state.workspacePath);
    const persistedServices = state.services || {};

    const foundationRepos = repos.filter((r) => r.config.group === 'foundation' && r.exists);
    const commonRepos = repos.filter((r) => r.config.group === 'common' && r.exists);
    const trackRepos = repos.filter((r) => r.config.group === 'track' && r.exists);

    const allRepos = [...foundationRepos, ...commonRepos, ...trackRepos];

    // Determine which service type columns are needed
    const usedTypes = new Set<ServiceType>();
    for (const repo of allRepos) {
      for (const service of repo.services) {
        if (!service.startScript) continue;
        const type = getServiceType(service.name);
        if (type) usedTypes.add(type);
      }
    }
    const columns = SERVICE_TYPES.filter((t) => usedTypes.has(t));

    // Header
    console.log('');
    console.log(
      chalk.bold('  Herdy') +
      (state.activeTrack ? chalk.yellow(`    Active Track: ${state.activeTrack}`) : '')
    );
    console.log('');

    const repoCol = 18;
    const branchCol = 14;
    const syncCol = 16;
    const dirtyCol = 6;
    const builtCol = 6;
    const typeCol = 8;

    const header =
      '  ' +
      'Repo'.padEnd(repoCol) +
      'Branch'.padEnd(branchCol) +
      'Sync'.padEnd(syncCol) +
      'Dirty'.padEnd(dirtyCol) +
      'Built'.padEnd(builtCol) +
      columns.map((c) => c.padEnd(typeCol)).join('');
    console.log(chalk.gray(header));
    console.log(chalk.gray('  ' + '─'.repeat(repoCol + branchCol + syncCol + dirtyCol + builtCol + columns.length * typeCol)));

    // Render rows
    const errors: { name: string; error: string }[] = [];

    async function renderRepo(repo: typeof allRepos[number]) {
      const branch = repo.gitStatus?.branch || '—';
      const behind = repo.gitStatus?.behindCount || 0;
      const fetchFailed = repo.gitStatus?.fetchFailed ?? false;

      let sync: string;
      if (fetchFailed) {
        sync = chalk.gray('? offline'.padEnd(syncCol));
      } else if (behind > 0) {
        sync = chalk.yellow(`↓ ${behind} behind`.padEnd(syncCol));
      } else {
        sync = chalk.green('✓ up to date'.padEnd(syncCol));
      }

      const dirty = repo.gitStatus?.isDirty
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
        const service = repo.services.find((s) => s.startScript && getServiceType(s.name) === type);
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
        repo.config.name.padEnd(repoCol) +
        branch.padEnd(branchCol) +
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
      console.log(chalk.gray('  ' + '┈'.repeat(repoCol + branchCol + syncCol + dirtyCol + builtCol + columns.length * typeCol)));
    }

    for (const repo of commonRepos) {
      await renderRepo(repo);
    }

    if (trackRepos.length > 0) {
      console.log(chalk.gray('  ' + '┈'.repeat(repoCol + branchCol + syncCol + dirtyCol + builtCol + columns.length * typeCol)));
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
