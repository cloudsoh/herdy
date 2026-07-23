import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { copyEnvExample, buildService } from '../src/core/service.js';

const TEST_DIR = resolve(tmpdir(), 'herdy-test-service');

describe('service operations', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('copyEnvExample', () => {
    it('copies .env.example to .env when .env does not exist', () => {
      writeFileSync(resolve(TEST_DIR, '.env.example'), 'DB_HOST=localhost\nDB_PORT=3306');
      const copied = copyEnvExample(TEST_DIR);
      expect(copied).toBe(true);
      expect(existsSync(resolve(TEST_DIR, '.env'))).toBe(true);
    });

    it('does not overwrite existing .env', () => {
      writeFileSync(resolve(TEST_DIR, '.env.example'), 'NEW=value');
      writeFileSync(resolve(TEST_DIR, '.env'), 'EXISTING=value');
      const copied = copyEnvExample(TEST_DIR);
      expect(copied).toBe(false);
    });

    it('returns false when no .env.example exists', () => {
      const copied = copyEnvExample(TEST_DIR);
      expect(copied).toBe(false);
    });
  });

  describe('buildService', () => {
    it('throws on missing build script', async () => {
      const pkgDir = resolve(TEST_DIR, 'no-build');
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(resolve(pkgDir, 'package.json'), JSON.stringify({
        name: 'test',
        scripts: {},
      }));

      await expect(buildService(pkgDir, 'build')).rejects.toThrow();
    });

    it('succeeds with a valid build script', async () => {
      const pkgDir = resolve(TEST_DIR, 'has-build');
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(resolve(pkgDir, 'package.json'), JSON.stringify({
        name: 'test',
        scripts: { build: 'echo "built"' },
      }));

      const output = await buildService(pkgDir, 'build');
      expect(output).toContain('built');
    });
  });
});
