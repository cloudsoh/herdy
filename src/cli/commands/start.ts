import { Command } from 'commander';
import chalk from 'chalk';
import { loadState, saveState } from '../../config/state.js';
import { scanWorkspace, getServicesForGroup, topologicalSort } from '../../core/workspace.js';
import { startService, buildService } from '../../core/service.js';
import { getCurrentCommit } from '../../core/git.js';
import { resolve } from 'node:path';

async function buildAndStartLevel(
  level: { repo: any; service: any }[],
  opts: { skipBuild: boolean; force: boolean }
): Promise<boolean> {
  const state = loadState();
  if (!state.builds) state.builds = {};

  const results = await Promise.all(
    level.map(async ({ repo, service }) => {
      const servicePath = resolve(repo.path, service.path);
      const buildKey = `${repo.config.name}/${service.path}`;

      if (!opts.skipBuild && service.buildScript) {
        // Check if rebuild is needed
        const currentCommit = await getCurrentCommit(repo.path).catch(() => '');
        const lastBuild = state.builds[buildKey];
        const needsRebuild = opts.force || !lastBuild || lastBuild.commit !== currentCommit;

        if (needsRebuild) {
          console.log(chalk.gray(`  Building ${service.name}...`));
          try {
            await buildService(servicePath, service.buildScript);
            // Record successful build
            state.builds[buildKey] = {
              commit: currentCommit,
              builtAt: new Date().toISOString(),
            };
            saveState(state);
          } catch (err: any) {
            console.log(chalk.red(`  ${service.name}: build failed - ${err.message}`));
            return false;
          }
        } else {
          console.log(chalk.gray(`  ${service.name}: skipped (already built at ${lastBuild.commit.slice(0, 7)})`));
        }
      }

      if (!service.startScript) {
        console.log(chalk.green(`  ${service.name}: built (library)`));
        return true;
      }

      console.log(chalk.gray(`  Starting ${service.name}...`));
      await startService(repo.path, service, repo.config.name, (status, error) => {
        if (status === 'running') {
          console.log(chalk.green(`  ${service.name}: running`));
        } else if (status === 'error') {
          console.log(chalk.red(`  ${service.name}: ${error}`));
        }
      });

      // Give the process a moment to fail fast (e.g. missing env, port conflict)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    })
  );

  return results.every(Boolean);
}

export const startCommand = new Command('start')
  .description('Start services. Specify repos/track or omit to start all.')
  .argument('[targets...]', 'Repo name(s) or track name to start. Omit to start foundation + common + active track.')
  .option('-t, --track <track>', 'Track to start (overrides active track)')
  .option('--skip-build', 'Skip build step')
  .option('-f, --force', 'Force rebuild even if already built')
  .action(async (targets: string[], opts) => {
    const state = loadState();
    if (!state.workspacePath) {
      console.log(chalk.red('No workspace linked. Run `herdy link` or `herdy init` first.'));
      return;
    }

    const repos = await scanWorkspace(state.workspacePath);

    if (targets.length > 0) {
      // Selective start: specific repos or track name
      for (const target of targets) {
        // Check if it's a track name
        const trackRepo = repos.find((r) => r.config.track === target && r.exists);
        if (trackRepo) {
          console.log(chalk.bold(`\nStarting track: ${target}...\n`));
          const trackServices = getServicesForGroup(repos, 'track', target);
          const trackLevels = topologicalSort(trackServices);
          for (const level of trackLevels) {
            const ok = await buildAndStartLevel(level, opts);
            if (!ok) {
              console.log(chalk.red(`\nAborted: ${target} build failed.`));
              break;
            }
          }
          continue;
        }

        // Check if it's a repo name
        const repo = repos.find((r) => r.config.name === target && r.exists);
        if (repo) {
          console.log(chalk.bold(`\nStarting ${target}...\n`));
          const repoServices = repo.services.map((service) => ({ repo, service }));
          const levels = topologicalSort(repoServices);
          for (const level of levels) {
            const ok = await buildAndStartLevel(level, opts);
            if (!ok) {
              console.log(chalk.red(`\nAborted: ${target} build failed.`));
              break;
            }
          }
          continue;
        }

        console.log(chalk.red(`Target "${target}" not found.`));
        console.log(chalk.gray(`Available repos: ${repos.map((r) => r.config.name).join(', ')}`));
      }
    } else {
      // Full start: foundation + common + active track
      const track = opts.track || state.activeTrack;

      // Build foundation first
      const foundationServices = getServicesForGroup(repos, 'foundation');
      if (foundationServices.length > 0) {
        console.log(chalk.bold('\nBuilding foundation libraries...\n'));
        const foundationLevels = topologicalSort(foundationServices);
        for (const level of foundationLevels) {
          const ok = await buildAndStartLevel(level, opts);
          if (!ok) {
            console.log(chalk.red('\nAborted: foundation build failed.'));
            return;
          }
        }
      }

      // Start common services
      console.log(chalk.bold('\nStarting common services...\n'));
      const commonServices = getServicesForGroup(repos, 'common');
      const commonLevels = topologicalSort(commonServices);
      for (const level of commonLevels) {
        const ok = await buildAndStartLevel(level, opts);
        if (!ok) {
          console.log(chalk.red('\nAborted: common service build failed.'));
          return;
        }
      }

      // Start track services
      if (track) {
        console.log(chalk.bold(`\nStarting ${track} track services...\n`));
        const trackServices = getServicesForGroup(repos, 'track', track);
        const trackLevels = topologicalSort(trackServices);
        for (const level of trackLevels) {
          const ok = await buildAndStartLevel(level, opts);
          if (!ok) {
            console.log(chalk.red('\nAborted: track service build failed.'));
            return;
          }
        }
      } else {
        console.log(chalk.gray('\nNo active track. Use `herdy switch <track>` to select one.'));
      }
    }

    console.log(chalk.green('\nDone. Services running. Press Ctrl+C to stop all.'));
    console.log(chalk.gray('Use `herdy status` in another terminal to check services.'));

    // Keep process alive — services die when herdy exits
    await new Promise(() => {});
  });
