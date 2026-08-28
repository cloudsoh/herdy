#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { initCommand } from './commands/init.js';
import { linkCommand } from './commands/link.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { switchCommand } from './commands/switch.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { installCommand } from './commands/install.js';
import { restartCommand } from './commands/restart.js';
import { configCommand } from './commands/config.js';
import { stopAllServices } from '../core/service.js';

async function gracefulShutdown() {
  console.log('\nShutting down services...');
  await stopAllServices();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const ERROR_LOG = resolve(homedir(), '.herdy', 'error.log');

function logError(err: unknown): void {
  const timestamp = new Date().toISOString();
  const entry = err instanceof Error
    ? `[${timestamp}] ${err.stack ?? err.message}`
    : `[${timestamp}] ${String(err)}`;
  try {
    mkdirSync(resolve(homedir(), '.herdy'), { recursive: true });
    appendFileSync(ERROR_LOG, entry + '\n\n');
  } catch {
    // best-effort — don't crash trying to log a crash
  }
}

process.on('uncaughtException', (err) => {
  logError(err);
  console.error(chalk.red(`\nError: ${err.message}`));
  console.error(chalk.gray(`  Full trace logged to ${ERROR_LOG}`));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError(reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(chalk.red(`\nError: ${message}`));
  console.error(chalk.gray(`  Full trace logged to ${ERROR_LOG}`));
  process.exit(1);
});

const program = new Command();

program
  .name('herdy')
  .description('Herdy - manage multi-service local development environments')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(linkCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(switchCommand);
program.addCommand(updateCommand);
program.addCommand(statusCommand);
program.addCommand(logsCommand);
program.addCommand(installCommand);
program.addCommand(restartCommand);
program.addCommand(configCommand);

program.parse();
