import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI = resolve(__dirname, '../dist/cli/index.js');
const run = (args: string) => {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, HOME: '/tmp/herdy-test-cli' },
    });
  } catch (err: any) {
    return err.stdout || err.stderr || err.message;
  }
};

describe('CLI commands', () => {
  it('--help shows all commands', () => {
    const output = run('--help');
    expect(output).toContain('herdy');
    expect(output).toContain('init');
    expect(output).toContain('link');
    expect(output).toContain('start');
    expect(output).toContain('stop');
    expect(output).toContain('switch');
    expect(output).toContain('update');
    expect(output).toContain('status');
    expect(output).toContain('logs');
    expect(output).toContain('install');
    expect(output).toContain('restart');
  });

  it('--version shows version', () => {
    const output = run('--version');
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('status fails gracefully without workspace', () => {
    const output = run('status');
    expect(output).toContain('No workspace linked');
  });

  it('start fails gracefully without workspace', () => {
    const output = run('start');
    expect(output).toContain('No workspace linked');
  });

  it('update fails gracefully without workspace', () => {
    const output = run('update');
    expect(output).toContain('No workspace linked');
  });

  it('stop requires an argument', () => {
    const output = run('stop');
    expect(output).toContain('Specify a target or --all');
  });

  it('logs without args shows help', () => {
    const output = run('logs');
    expect(output).toContain('Specify a service name');
  });

  it('herdy dev is removed', () => {
    const output = run('dev');
    expect(output).toContain("unknown command 'dev'");
  });
});
