import { Command } from 'commander';
import chalk from 'chalk';
import { loadWorkspaceConfig, resolveConfigPath, setWorkspaceConfig, SETTABLE_KEYS, type SettableKey } from '../../config/workspace-config.js';
import { existsSync } from 'node:fs';

export const configCommand = new Command('config')
  .description('Read or update workspace configuration in herdy.yaml');

configCommand
  .command('set <key> <value>')
  .description(`Set a config value. Keys: ${SETTABLE_KEYS.join(', ')}`)
  .action((key: string, value: string) => {
    if (!SETTABLE_KEYS.includes(key as SettableKey)) {
      console.log(chalk.red(`Unknown key: ${key}`));
      console.log(chalk.gray(`Settable keys: ${SETTABLE_KEYS.join(', ')}`));
      process.exit(1);
    }
    setWorkspaceConfig(key as SettableKey, value);
    console.log(chalk.green(`  ${key} = ${value}`));
  });

configCommand
  .command('get <key>')
  .description('Get a config value')
  .action((key: string) => {
    const config = loadWorkspaceConfig();
    const value = (config as unknown as Record<string, unknown>)[key];
    if (value === undefined) {
      console.log(chalk.red(`Key not found: ${key}`));
      process.exit(1);
    }
    console.log(String(value));
  });

configCommand
  .command('list')
  .description('Show all workspace config')
  .action(() => {
    const config = loadWorkspaceConfig();
    console.log('');
    for (const key of SETTABLE_KEYS) {
      const value = config[key] ?? chalk.gray('(not set)');
      console.log(`  ${chalk.bold(key.padEnd(16))} ${value}`);
    }
    console.log('');
  });

configCommand
  .command('validate')
  .description('Check herdy.yaml for syntax errors and required fields')
  .action(() => {
    let configPath: string;
    try {
      configPath = resolveConfigPath();
    } catch {
      console.log(chalk.red('  herdy.yaml not found.'));
      process.exit(1);
    }

    console.log('');
    console.log(chalk.gray(`  File: ${configPath}`));
    console.log('');

    let config: ReturnType<typeof loadWorkspaceConfig>;
    try {
      config = loadWorkspaceConfig();
      console.log(chalk.green('  ✓ YAML syntax is valid'));
    } catch (err: any) {
      console.log(chalk.red('  ✗ ' + err.message));
      process.exit(1);
    }

    const checks: { label: string; ok: boolean; detail?: string }[] = [
      {
        label: 'nodeVersion',
        ok: typeof config.nodeVersion === 'string' && config.nodeVersion.length > 0,
        detail: config.nodeVersion ? String(config.nodeVersion) : undefined,
      },
      {
        label: 'baseBranch',
        ok: typeof config.baseBranch === 'string' && config.baseBranch.length > 0,
        detail: config.baseBranch,
      },
      {
        label: 'repos',
        ok: Array.isArray(config.repos) && config.repos.length > 0,
        detail: Array.isArray(config.repos) ? `${config.repos.length} entries` : 'missing or not an array',
      },
      {
        label: 'tracks',
        ok: config.tracks == null || Array.isArray(config.tracks),
        detail: Array.isArray(config.tracks)
          ? `${config.tracks.length} entries`
          : config.tracks == null
          ? '(not set)'
          : 'not an array',
      },
    ];

    for (const check of checks) {
      const icon = check.ok ? chalk.green('✓') : chalk.red('✗');
      const label = check.label.padEnd(14);
      const detail = check.detail ? chalk.gray(check.detail) : '';
      console.log(`  ${icon} ${label} ${detail}`);
    }

    const repoIssues: string[] = [];
    if (Array.isArray(config.repos)) {
      for (const repo of config.repos) {
        if (!repo.name) repoIssues.push(`a repo entry is missing 'name'`);
        if (!repo.url) repoIssues.push(`repo '${repo.name ?? '?'}' is missing 'url'`);
        if (!repo.group) repoIssues.push(`repo '${repo.name ?? '?'}' is missing 'group'`);
      }
    }
    if (repoIssues.length > 0) {
      console.log('');
      for (const issue of repoIssues) {
        console.log(chalk.yellow(`  ⚠ ${issue}`));
      }
    }

    const allOk = checks.every((c) => c.ok) && repoIssues.length === 0;
    console.log('');
    if (allOk) {
      console.log(chalk.green('  Config looks good.'));
    } else {
      console.log(chalk.yellow('  Some issues were found — see above.'));
      process.exit(1);
    }
    console.log('');
  });
