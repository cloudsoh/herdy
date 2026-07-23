import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { initWorkspace } from '../../core/init.js';
import { checkNodeVersion, checkNInstalled } from '../../core/node-version.js';
import { loadWorkspaceConfig } from '../../config/workspace-config.js';
import { loadState } from '../../config/state.js';
import { createInterface } from 'node:readline';

export const initCommand = new Command('init')
  .description('Initialize workspace: clone repos, install dependencies, build services')
  .option('-f, --force', 'Reinstall all services from scratch')
  .option('-p, --path <path>', 'Workspace path', process.cwd())
  .action(async (opts) => {
    const workspacePath = resolve(opts.path);
    const config = loadWorkspaceConfig();

    // Check node version
    const hasN = await checkNInstalled();
    if (!hasN) {
      console.log(chalk.yellow('Warning: `n` (Node version manager) is not installed.'));
      console.log(chalk.yellow('Install it with: npm install -g n'));
    }

    const nodeCheck = await checkNodeVersion(config.nodeVersion);
    if (!nodeCheck.ok) {
      console.log(chalk.red(`Node version mismatch: current=${nodeCheck.current}, required=${config.nodeVersion}`));
      console.log(chalk.yellow(`Run: n ${config.nodeVersion}`));
      return;
    }

    // Force prompt
    if (opts.force) {
      const confirmed = await promptConfirm('This will reinstall all services. Continue?');
      if (!confirmed) {
        console.log('Cancelled.');
        return;
      }
    }

    // Check resume
    const state = loadState();
    if (!opts.force && Object.keys(state.initProgress).length > 0) {
      console.log(chalk.cyan('Resuming from previous init progress...'));
    }

    console.log(chalk.bold(`\nInitializing workspace at ${workspacePath}\n`));

    await initWorkspace(workspacePath, opts.force, {
      onRepoStart(repoName, step) {
        process.stdout.write(chalk.gray(`  ${repoName}: ${step}...`));
      },
      onRepoComplete(repoName, step) {
        process.stdout.write(chalk.green(' done\n'));
      },
      onRepoError(repoName, step, error) {
        process.stdout.write(chalk.red(` failed\n`));
        console.log(chalk.red(`    Error: ${error}\n`));
      },
      onProgress(completed, total) {
        const pct = Math.round((completed / total) * 100);
        process.stdout.write(`\r${chalk.cyan(`[${pct}%]`)} `);
      },
    });

    console.log(chalk.green('\nInit complete!'));
    console.log(chalk.gray('Run `herdy dev` to launch the dashboard.'));
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
