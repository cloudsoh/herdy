import { Command } from 'commander';
import chalk from 'chalk';
import { createInterface } from 'node:readline';
import { loadState, saveState } from '../../config/state.js';
import { loadWorkspaceConfig } from '../../config/workspace-config.js';
import { scanWorkspace, getServicesForGroup, topologicalSort } from '../../core/workspace.js';
import { stopService, startService, buildService, getManagedServices } from '../../core/service.js';
import { resolve } from 'node:path';

export const switchCommand = new Command('switch')
  .description('Switch active track')
  .argument('<track>', 'Track name to switch to (must match a track defined in herdy.yaml)')
  .option('--no-prompt', 'Skip confirmation prompt')
  .option('--set-only', 'Record the active track without stopping/starting services')
  .action(async (track, opts) => {
    const config = loadWorkspaceConfig();
    const state = loadState();

    if (!state.workspacePath) {
      console.log(chalk.red('No workspace linked. Run `herdy link` or `herdy init` first.'));
      return;
    }

    if (!config?.tracks?.length) {
      console.log(chalk.red('No tracks defined in herdy.yaml. Add a `tracks:` section first.'));
      return;
    }

    const validTracks = config.tracks.map((t) => t.name);
    if (!validTracks.includes(track)) {
      console.log(chalk.red(`Invalid track: ${track}. Available: ${validTracks.join(', ')}`));
      return;
    }

    if (state.activeTrack === track) {
      console.log(chalk.yellow(`Already on track: ${track}`));
      return;
    }

    if (opts.setOnly) {
      state.activeTrack = track;
      saveState(state);
      console.log(chalk.green(`Active track set to: ${track}`));
      return;
    }

    // Prompt to stop current track
    if (state.activeTrack && opts.prompt) {
      const confirmed = await promptConfirm(
        `Track "${state.activeTrack}" is active. Stop its services and switch to "${track}"?`
      );
      if (!confirmed) {
        console.log('Cancelled.');
        return;
      }
    }

    // Stop old track services
    if (state.activeTrack) {
      console.log(chalk.gray(`\nStopping ${state.activeTrack} track services...`));
      const repos = await scanWorkspace(state.workspacePath);
      const oldTrackServices = getServicesForGroup(repos, 'track', state.activeTrack);
      for (const { service } of oldTrackServices) {
        if (getManagedServices().has(service.name)) {
          await stopService(service.name);
          console.log(chalk.gray(`  Stopped ${service.name}`));
        }
      }
    }

    // Update active track
    state.activeTrack = track;
    saveState(state);

    // Start new track services
    console.log(chalk.bold(`\nStarting ${track} track services...\n`));
    const repos = await scanWorkspace(state.workspacePath);
    const trackServices = getServicesForGroup(repos, 'track', track);
    const levels = topologicalSort(trackServices);

    for (const level of levels) {
      await Promise.all(
        level.map(async ({ repo, service }) => {
          const servicePath = resolve(repo.path, service.path);
          console.log(chalk.gray(`  Starting ${service.name}...`));

          if (service.buildScript) {
            try {
              await buildService(servicePath, service.buildScript);
            } catch (err: any) {
              console.log(chalk.red(`  ${service.name}: build failed - ${err.message}`));
              return;
            }
          }

          await startService(repo.path, service, repo.config.name, (status, error) => {
            if (status === 'running') {
              console.log(chalk.green(`  ${service.name}: running`));
            } else if (status === 'error') {
              console.log(chalk.red(`  ${service.name}: ${error}`));
            }
          });
        })
      );
    }

    console.log(chalk.green(`\nSwitched to track: ${track}`));
  });

function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}
