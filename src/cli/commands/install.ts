import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { loadState } from '../../config/state.js';
import { scanWorkspace } from '../../core/workspace.js';
import { installService, buildService } from '../../core/service.js';

function hasNpmWorkspaces(repoPath: string): boolean {
  const pkgPath = resolve(repoPath, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
  } catch {
    return false;
  }
}

export const installCommand = new Command('install')
  .description('Install and build a specific repo or all repos')
  .argument('[repo]', 'Repo name to install (installs all if omitted)')
  .option('--no-build', 'Skip build after install')
  .action(async (repo, opts) => {
    const state = loadState();
    if (!state.workspacePath) {
      console.log(chalk.red('No workspace linked. Run `herdy link` or `herdy init` first.'));
      return;
    }

    const repos = await scanWorkspace(state.workspacePath);
    const targets = repo
      ? repos.filter((r) => r.config.name === repo)
      : repos.filter((r) => r.exists);

    if (repo && targets.length === 0) {
      console.log(chalk.red(`Repo "${repo}" not found.`));
      console.log(chalk.gray(`Available: ${repos.map((r) => r.config.name).join(', ')}`));
      return;
    }

    for (const target of targets) {
      console.log(chalk.cyan(`\n${target.config.name}:`));

      // For npm workspaces repos, install at the repo root first so cross-package
      // symlinks are created before building individual packages
      if (hasNpmWorkspaces(target.path)) {
        try {
          process.stdout.write(chalk.gray(`  Installing workspace root... `));
          await installService(target.path);
          console.log(chalk.green('done'));
        } catch (err: any) {
          console.log(chalk.red(`failed: ${err.message}`));
          continue;
        }
      }

      for (const service of target.services) {
        const servicePath = resolve(target.path, service.path);

        try {
          process.stdout.write(chalk.gray(`  Installing ${service.name}... `));
          await installService(servicePath);
          console.log(chalk.green('done'));
        } catch (err: any) {
          console.log(chalk.red(`failed: ${err.message}`));
          continue;
        }

        if (opts.build && service.buildScript) {
          try {
            process.stdout.write(chalk.gray(`  Building ${service.name}... `));
            await buildService(servicePath, service.buildScript);
            console.log(chalk.green('done'));
          } catch (err: any) {
            console.log(chalk.red(`failed: ${err.message}`));
          }
        }
      }
    }

    console.log(chalk.green('\nDone.'));
  });
