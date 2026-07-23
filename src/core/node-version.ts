import { execaCommand } from 'execa';

export async function checkNodeVersion(requiredVersion: string): Promise<{
  ok: boolean;
  current: string;
  required: string;
}> {
  const result = await execaCommand('node --version', { reject: false });
  const current = result.stdout.trim().replace(/^v/, '');
  const requiredMajor = requiredVersion.split('.')[0];
  const currentMajor = current.split('.')[0];

  return {
    ok: currentMajor === requiredMajor,
    current,
    required: requiredVersion,
  };
}

export async function checkNInstalled(): Promise<boolean> {
  const result = await execaCommand('which n', { reject: false });
  return result.exitCode === 0;
}

export async function installNodeVersion(version: string): Promise<void> {
  await execaCommand(`n ${version}`);
}
