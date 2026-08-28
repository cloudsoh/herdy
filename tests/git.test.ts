import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as git from '../src/core/git.js';

const TEST_REPO = resolve(tmpdir(), 'herdy-test-git');

describe('git operations', () => {
  beforeEach(() => {
    rmSync(TEST_REPO, { recursive: true, force: true });
    mkdirSync(TEST_REPO, { recursive: true });
    execSync('git init', { cwd: TEST_REPO, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: TEST_REPO, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: TEST_REPO, stdio: 'pipe' });
    execSync('git config commit.gpgsign false', { cwd: TEST_REPO, stdio: 'pipe' });
    execSync('git config core.hooksPath /dev/null', { cwd: TEST_REPO, stdio: 'pipe' });
    writeFileSync(resolve(TEST_REPO, 'file.txt'), 'hello');
    execSync('git add . && git commit -m "initial"', { cwd: TEST_REPO, stdio: 'pipe' });
  });

  afterEach(() => {
    rmSync(TEST_REPO, { recursive: true, force: true });
  });

  it('getCurrentBranch returns branch name', async () => {
    const branch = await git.getCurrentBranch(TEST_REPO);
    expect(['main', 'master']).toContain(branch);
  });

  it('getCurrentCommit returns a SHA', async () => {
    const commit = await git.getCurrentCommit(TEST_REPO);
    expect(commit).toMatch(/^[a-f0-9]{40}$/);
  });

  it('isDirty returns false for clean repo', async () => {
    const dirty = await git.isDirty(TEST_REPO);
    expect(dirty).toBe(false);
  });

  it('isDirty returns true for modified file', async () => {
    writeFileSync(resolve(TEST_REPO, 'file.txt'), 'changed');
    const dirty = await git.isDirty(TEST_REPO);
    expect(dirty).toBe(true);
  });

  it('discardLockFiles removes package-lock changes', async () => {
    writeFileSync(resolve(TEST_REPO, 'package-lock.json'), '{}');
    execSync('git add package-lock.json && git commit -m "add lock"', { cwd: TEST_REPO, stdio: 'pipe' });
    writeFileSync(resolve(TEST_REPO, 'package-lock.json'), '{"modified": true}');

    await git.discardLockFiles(TEST_REPO);

    const dirty = await git.isDirty(TEST_REPO);
    expect(dirty).toBe(false);
  });

  it('stash saves and restores changes', async () => {
    writeFileSync(resolve(TEST_REPO, 'file.txt'), 'changed');
    await git.stash(TEST_REPO, 'test stash');

    const dirty = await git.isDirty(TEST_REPO);
    expect(dirty).toBe(false);

    const hasIt = await git.hasStash(TEST_REPO);
    expect(hasIt).toBe(true);
  });

  it('checkout switches branches', async () => {
    execSync('git checkout -b test-branch', { cwd: TEST_REPO, stdio: 'pipe' });
    execSync('git checkout -', { cwd: TEST_REPO, stdio: 'pipe' });

    await git.checkout('test-branch', TEST_REPO);
    const branch = await git.getCurrentBranch(TEST_REPO);
    expect(branch).toBe('test-branch');
  });
});
