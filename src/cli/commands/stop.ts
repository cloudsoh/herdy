import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync } from 'node:fs';
import treeKill from 'tree-kill';
import { readPid, deletePid, isPidAlive, getPidDir } from '../../core/pid.js';
import { loadState } from '../../config/state.js';
import { scanWorkspaceLocal } from '../../core/workspace.js';

async function killByPid(serviceName: string): Promise<void> {
  const pid = readPid(serviceName);
  if (pid === null) {
    console.log(chalk.gray(`  ${serviceName}: not running`));
    return;
  }
  if (!isPidAlive(pid)) {
    deletePid(serviceName);
    console.log(chalk.gray(`  ${serviceName}: not running (stale pid removed)`));
    return;
  }
  await new Promise<void>((resolve) => {
    treeKill(pid, 'SIGTERM', (err) => {
      if (err) {
        console.log(chalk.red(`  ${serviceName}: failed to stop — ${err.message}`));
      } else {
        deletePid(serviceName);
        console.log(chalk.green(`  ${serviceName}: stopped`));
      }
      resolve();
    });
  });
}

export const stopCommand = new Command('stop')
  .description('Stop services by service/repo/track name, or --all')
  .argument('[target]', 'Service name, repo name, or track name')
  .option('--all', 'Stop all running services')
  .action(async (target, opts) => {
    if (!target && !opts.all) {
      console.log(chalk.red('Specify a target or --all'));
      console.log(chalk.gray('  herdy stop <service>    stop a specific service'));
      console.log(chalk.gray('  herdy stop <repo>       stop all services in a repo'));
      console.log(chalk.gray('  herdy stop <track>      stop all services in a track'));
      console.log(chalk.gray('  herdy stop --all        stop everything'));
      return;
    }

    if (opts.all) {
      const pidDir = getPidDir();
      if (!existsSync(pidDir)) {
        console.log(chalk.gray('No services running.'));
        return;
      }
      const names = readdirSync(pidDir)
        .filter((f) => f.endsWith('.pid'))
        .map((f) => f.slice(0, -4));
      if (names.length === 0) {
        console.log(chalk.gray('No services running.'));
        return;
      }
      console.log(chalk.gray(`Stopping ${names.length} service(s)...`));
      await Promise.all(names.map(killByPid));
      return;
    }

    const state = loadState();

    if (state.workspacePath) {
      const repos = scanWorkspaceLocal(state.workspacePath);

      // Check if target is a track name
      const trackRepos = repos.filter(
        (r) => r.config.group === 'track' && r.config.track === target && r.exists
      );
      if (trackRepos.length > 0) {
        const serviceNames = trackRepos.flatMap((r) => r.services.map((s) => s.name));
        console.log(chalk.gray(`Stopping track "${target}" (${serviceNames.length} service(s))...`));
        await Promise.all(serviceNames.map(killByPid));
        return;
      }

      // Check if target is a repo name
      const targetRepo = repos.find((r) => r.config.name === target && r.exists);
      if (targetRepo) {
        const serviceNames = targetRepo.services.map((s) => s.name);
        console.log(chalk.gray(`Stopping repo "${target}" (${serviceNames.length} service(s))...`));
        await Promise.all(serviceNames.map(killByPid));
        return;
      }
    }

    // Fall through: treat as a direct service name
    await killByPid(target);
  });
