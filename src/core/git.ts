import { execaCommand, execa } from 'execa';
import type { GitStatus } from '../types.js';

async function git(args: string, cwd: string): Promise<string> {
  const result = await execaCommand(`git ${args}`, { cwd, reject: false });
  if (result.exitCode !== 0) {
    const msg = result.stderr || result.stdout || `exit code ${result.exitCode}`;
    throw new Error(`git ${args} failed: ${msg}`);
  }
  return result.stdout.trim();
}

export interface CommitInfo {
  hash: string;
  date: string;
  subject: string;
}

export async function getCommitInfo(cwd: string, ref = 'HEAD'): Promise<CommitInfo> {
  const raw = await git(`log -1 --format=%H|%cd|%s --date=format:%Y-%m-%d ${ref}`, cwd);
  const [hash, date, ...rest] = raw.split('|');
  return { hash: hash.slice(0, 7), date, subject: rest.join('|') };
}

export async function clone(url: string, dest: string): Promise<void> {
  await execaCommand(`git clone ${url} ${dest}`);
}

export async function fetch(cwd: string, remote = 'origin'): Promise<void> {
  await git(`fetch ${remote}`, cwd);
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  return git('rev-parse --abbrev-ref HEAD', cwd);
}

export async function getCurrentCommit(cwd: string): Promise<string> {
  return git('rev-parse HEAD', cwd);
}

export async function checkout(branch: string, cwd: string): Promise<void> {
  await git(`checkout ${branch}`, cwd);
}

export async function pull(cwd: string): Promise<void> {
  await git('pull', cwd);
}

export async function getStatus(cwd: string, remoteBranch: string, remote = 'origin'): Promise<GitStatus> {
  let fetchFailed = false;
  try {
    await fetch(cwd, remote);
  } catch {
    fetchFailed = true;
  }

  const branch = await getCurrentBranch(cwd);
  const behindOutput = await git(`rev-list --count HEAD..${remote}/${remoteBranch}`, cwd).catch(() => '0');
  const aheadOutput = await git(`rev-list --count ${remote}/${remoteBranch}..HEAD`, cwd).catch(() => '0');
  const dirtyOutput = await git('status --porcelain', cwd);

  return {
    branch,
    behindCount: parseInt(behindOutput, 10) || 0,
    aheadCount: parseInt(aheadOutput, 10) || 0,
    isDirty: dirtyOutput.length > 0,
    fetchFailed,
  };
}

export async function stash(cwd: string, message?: string): Promise<boolean> {
  const msg = message || 'herdy-auto-stash';
  const before = await git('stash list', cwd);
  await execa('git', ['stash', 'push', '--include-untracked', '-m', msg], { cwd, reject: false });
  const after = await git('stash list', cwd);
  return before !== after;
}

export async function hasStash(cwd: string): Promise<boolean> {
  const output = await git('stash list', cwd);
  return output.length > 0;
}

export async function discardLockFiles(cwd: string): Promise<void> {
  const result = await execaCommand('git status --porcelain', { cwd, reject: false });
  const lockFiles = result.stdout
    .split('\n')
    .filter((line) => line.length > 0 && line.trimEnd().endsWith('package-lock.json'))
    .map((line) => line.slice(3).trim());
  for (const file of lockFiles) {
    await execaCommand(`git restore --staged --worktree -- ${file}`, { cwd, reject: false });
  }
}

export async function pullRebase(cwd: string): Promise<void> {
  await git('pull --rebase', cwd);
}

export async function isDirty(cwd: string): Promise<boolean> {
  const output = await git('status --porcelain', cwd);
  return output.length > 0;
}

export async function resetToRemote(branch: string, cwd: string, remote = 'origin'): Promise<void> {
  await git(`checkout ${branch}`, cwd);
  await git(`reset --hard ${remote}/${branch}`, cwd);
}
