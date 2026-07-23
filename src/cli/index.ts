#!/usr/bin/env node

import { Command } from 'commander';
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
import { stopAllServices } from '../core/service.js';

async function gracefulShutdown() {
  console.log('\nShutting down services...');
  await stopAllServices();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

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

program.parse();
