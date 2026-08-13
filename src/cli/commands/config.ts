import { Command } from 'commander';
import chalk from 'chalk';
import { loadWorkspaceConfig, setWorkspaceConfig, SETTABLE_KEYS, type SettableKey } from '../../config/workspace-config.js';

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
