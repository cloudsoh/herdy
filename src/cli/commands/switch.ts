import { Command } from 'commander';
import chalk from 'chalk';
import { loadState, saveState } from '../../config/state.js';
import { loadWorkspaceConfig } from '../../config/workspace-config.js';

export const switchCommand = new Command('switch')
  .description('Set the active track (config only — run `herdy start` to start services)')
  .argument('<track>', 'Track name to activate (must match a track defined in herdy.yaml)')
  .action(async (track) => {
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

    state.activeTrack = track;
    saveState(state);
    console.log(chalk.green(`Active track set to: ${track}`));
    console.log(chalk.gray('Run `herdy start` to start services.'));
  });
