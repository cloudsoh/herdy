import { Command } from 'commander';
import chalk from 'chalk';
import { stopAllServices, stopService, getManagedServices } from '../../core/service.js';

export const stopCommand = new Command('stop')
  .description('Stop running services')
  .argument('[service]', 'Specific service to stop (stops all if omitted)')
  .action(async (service) => {
    if (service) {
      console.log(chalk.gray(`Stopping ${service}...`));
      await stopService(service);
      console.log(chalk.green(`${service} stopped.`));
    } else {
      const services = getManagedServices();
      if (services.size === 0) {
        console.log(chalk.gray('No services running.'));
        return;
      }
      console.log(chalk.gray(`Stopping ${services.size} services...`));
      await stopAllServices();
      console.log(chalk.green('All services stopped.'));
    }
  });
