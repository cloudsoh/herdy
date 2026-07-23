import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'node:path';
import { loadState } from '../../config/state.js';
import { scanWorkspace, getServicesForGroup, topologicalSort, type RepoInfo } from '../../core/workspace.js';
import { stopService, startService, buildService, getManagedServices } from '../../core/service.js';
import { getServiceType } from '../../config/service-config.js';
import type { ServiceConfig } from '../../types.js';

const GROUPS = ['foundation', 'common', 'track'] as const;

export const restartCommand = new Command('restart')
  .description('Restart service(s), repo(s), or group. Use --build to rebuild first.')
  .argument('<targets...>', 'Service name(s), repo name(s), or group (foundation/common/track)')
  .option('-b, --build', 'Rebuild before restarting')
  .option('-f, --force', 'Force rebuild even if already built at current commit')
  .action(async (targets: string[], opts) => {
    const state = loadState();
    if (!state.workspacePath) {
      console.log(chalk.red('No workspace linked. Run `herdy link` or `herdy init` first.'));
      return;
    }

    const repos = await scanWorkspace(state.workspacePath);
    const managed = getManagedServices();

    // Resolve all targets to a list of services
    const resolved: { repo: RepoInfo; service: ServiceConfig }[] = [];
    for (const target of targets) {
      const result = resolveTarget(target, repos, state.activeTrack);
      if (!result || result.length === 0) {
        console.log(chalk.red(`Target "${target}" not found.`));
        console.log(chalk.gray('Valid targets: service name, repo name, or group (foundation/common/track)'));
        return;
      }
      resolved.push(...result);
    }

    // Deduplicate by service name
    const seen = new Set<string>();
    const unique = resolved.filter((r) => {
      if (seen.has(r.service.name)) return false;
      seen.add(r.service.name);
      return true;
    });

    console.log(chalk.bold(`\nRestarting ${unique.length} service(s)...\n`));

    for (const { repo, service } of unique) {
      const servicePath = resolve(repo.path, service.path);

      // Build if requested
      if (opts.build && service.buildScript) {
        console.log(chalk.gray(`  Building ${service.name}...`));
        try {
          await buildService(servicePath, service.buildScript);
          console.log(chalk.green(`  ${service.name}: built`));
        } catch (err: any) {
          console.log(chalk.red(`  ${service.name}: build failed - ${err.message}`));
          continue;
        }
      }

      // Skip non-runnable services
      if (!service.startScript) {
        if (opts.build) {
          console.log(chalk.green(`  ${service.name}: rebuilt (library)`));
        }
        continue;
      }

      // Stop if currently running
      if (managed.has(service.name)) {
        console.log(chalk.gray(`  Stopping ${service.name}...`));
        await stopService(service.name);
      }

      // Start
      console.log(chalk.gray(`  Starting ${service.name}...`));
      await startService(repo.path, service, repo.config.name, (status, error) => {
        if (status === 'running') {
          console.log(chalk.green(`  ${service.name}: running`));
        } else if (status === 'error') {
          console.log(chalk.red(`  ${service.name}: ${error}`));
        }
      });

      // Brief wait to catch immediate crashes
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(chalk.green('\nDone.'));
  });

function resolveTarget(
  target: string,
  repos: RepoInfo[],
  activeTrack?: string
): { repo: RepoInfo; service: ServiceConfig }[] | null {
  // 1. Check if it's a group name
  if (GROUPS.includes(target as any)) {
    const group = target as 'foundation' | 'common' | 'track';
    return getServicesForGroup(repos, group, activeTrack);
  }

  // 2. Check if it's a repo name
  const matchedRepo = repos.find((r) => r.config.name === target && r.exists);
  if (matchedRepo) {
    return matchedRepo.services.map((service) => ({ repo: matchedRepo, service }));
  }

  // 3. Check if it's a service name
  for (const repo of repos) {
    const service = repo.services.find((s) => s.name === target);
    if (service) {
      return [{ repo, service }];
    }
  }

  return null;
}
