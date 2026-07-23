import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { linkWorkspace, scanWorkspace } from '../../core/workspace.js';

export const linkCommand = new Command('link')
  .description('Link an existing workspace directory to the CLI')
  .argument('[path]', 'Path to workspace directory', process.cwd())
  .action(async (path) => {
    const workspacePath = resolve(path);
    console.log(chalk.bold(`Linking workspace at ${workspacePath}\n`));

    const state = await linkWorkspace(workspacePath);
    const repos = await scanWorkspace(workspacePath);

    const found = repos.filter((r) => r.exists);
    const missing = repos.filter((r) => !r.exists);

    console.log(chalk.green(`Found ${found.length} repos:`));
    for (const repo of found) {
      const branch = repo.gitStatus?.branch || 'unknown';
      const behind = repo.gitStatus?.behindCount || 0;
      const syncStatus = behind > 0
        ? chalk.yellow(`↓ ${behind} behind`)
        : chalk.green('✓ up to date');
      console.log(`  ${repo.config.name.padEnd(20)} ${branch.padEnd(15)} ${syncStatus}`);
    }

    if (missing.length > 0) {
      console.log(chalk.yellow(`\nMissing ${missing.length} repos (run \`herdy init\` to clone):`));
      for (const repo of missing) {
        console.log(chalk.gray(`  ${repo.config.name}`));
      }
    }

    console.log(chalk.gray('\nWorkspace linked. Run `herdy dev` to launch the dashboard.'));
  });
