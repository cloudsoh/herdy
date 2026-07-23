import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { getServiceLogs } from '../../core/service.js';
import { isTmuxAvailable, createTmuxLogSession, attachTmuxSession } from '../../core/tmux.js';
import { loadState } from '../../config/state.js';

const LOG_DIR = resolve(homedir(), '.herdy', 'logs');

function getRunningServices(): string[] {
  const state = loadState();
  const services = state.services || {};
  const running: string[] = [];
  for (const [name, svc] of Object.entries(services)) {
    if (svc.status === 'running' && svc.pid) {
      try {
        process.kill(svc.pid, 0);
        running.push(name);
      } catch {}
    }
  }
  return running;
}

export const logsCommand = new Command('logs')
  .description('Tail logs for a service or all services (via tmux)')
  .argument('[service]', 'Service name to view logs for')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .option('-f, --follow', 'Follow log output', false)
  .option('-a, --all', 'View all running service logs in tmux split panes')
  .action(async (service, opts) => {
    // tmux multi-pane mode
    if (opts.all) {
      const hasTmux = await isTmuxAvailable();
      if (!hasTmux) {
        console.log(chalk.red('tmux is not installed. Install with: brew install tmux'));
        return;
      }

      const running = getRunningServices();
      if (running.length === 0) {
        console.log(chalk.gray('No services running.'));
        return;
      }

      const sessionName = 'herdy-logs';
      const logDir = resolve(LOG_DIR);
      const services = running.map((name) => ({
        name,
        logCommand: `tail -n 500 -F ${resolve(logDir, name + '.log')}`,
      }));

      console.log(chalk.cyan(`Creating tmux session "${sessionName}" with ${services.length} panes...`));
      try {
        await createTmuxLogSession(sessionName, services);
      } catch (err: any) {
        console.log(chalk.red(`Failed: ${err.message}`));
        return;
      }
      console.log(chalk.gray('Attaching to tmux session... (Ctrl+B d to detach)'));
      attachTmuxSession(sessionName);
      return;
    }

    // Single service mode
    if (!service) {
      console.log(chalk.red('Specify a service name, or use --all for all logs in tmux.'));
      const running = getRunningServices();
      if (running.length > 0) {
        console.log(chalk.gray(`Running: ${running.join(', ')}`));
      }
      return;
    }

    // Read logs from file
    const lines = parseInt(opts.lines, 10);
    const logs = getServiceLogs(service, lines);

    if (logs.length === 0) {
      console.log(chalk.gray(`No logs found for "${service}".`));
      const running = getRunningServices();
      if (running.length > 0) {
        console.log(chalk.gray(`Running services: ${running.join(', ')}`));
      }
      return;
    }

    console.log(chalk.bold(`\nLogs for ${service} (last ${lines} lines):\n`));
    for (const line of logs) {
      process.stdout.write(line.endsWith('\n') ? line : line + '\n');
    }

    if (opts.follow) {
      console.log(chalk.gray('\n--- Following logs (Ctrl+C to exit) ---\n'));
      const logPath = resolve(LOG_DIR, `${service}.log`);

      let lastSize = existsSync(logPath) ? statSync(logPath).size : 0;
      const interval = setInterval(() => {
        if (!existsSync(logPath)) {
          lastSize = 0;
          return;
        }
        const currentSize = statSync(logPath).size;

        // File was truncated (service restarted) — reset and follow from start
        if (currentSize < lastSize) {
          console.log(chalk.gray('\n--- Service restarted ---\n'));
          lastSize = 0;
        }

        if (currentSize > lastSize) {
          const fd = openSync(logPath, 'r');
          const buf = Buffer.alloc(currentSize - lastSize);
          readSync(fd, buf, 0, buf.length, lastSize);
          closeSync(fd);
          process.stdout.write(buf.toString());
          lastSize = currentSize;
        }
      }, 200);

      // Don't hold stdin — let tmux handle Ctrl+B
      if (process.stdin.unref) process.stdin.unref();

      process.on('SIGINT', () => {
        clearInterval(interval);
        process.exit(0);
      });

      // setInterval keeps process alive, no need for extra promise
      await new Promise(() => {});
    }
  });
