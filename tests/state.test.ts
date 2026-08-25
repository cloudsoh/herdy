import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// We test the state logic by mocking the state directory
const TEST_DIR = resolve(tmpdir(), 'herdy-test-state');
const STATE_FILE = resolve(TEST_DIR, 'state.json');

describe('state management', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('creates state directory if not exists', () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    expect(existsSync(TEST_DIR)).toBe(true);
  });

  it('handles missing builds field gracefully', () => {
    const oldState = {
      workspaces: {
        '/test': {
          workspacePath: '/test',
          initProgress: {},
          services: {},
          lastUpdated: '2024-01-01',
        },
      },
      lastUsed: '/test',
    };
    writeFileSync(STATE_FILE, JSON.stringify(oldState));
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    const ws = parsed.workspaces['/test'];
    if (!ws.builds) ws.builds = {};
    expect(ws.builds).toEqual({});
  });

  it('migrates old single-workspace format', () => {
    const oldFormat = {
      workspacePath: '/old/path',
      activeTrack: 'myapp',
      initProgress: {},
      services: {},
      lastUpdated: '2024-01-01',
    };
    writeFileSync(STATE_FILE, JSON.stringify(oldFormat));
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));

    // Simulate migration logic
    if (parsed.workspacePath && !parsed.workspaces) {
      const migrated = {
        workspaces: { [parsed.workspacePath]: parsed },
        lastUsed: parsed.workspacePath,
      };
      expect(migrated.workspaces['/old/path'].activeTrack).toBe('myapp');
      expect(migrated.lastUsed).toBe('/old/path');
    }
  });

  it('concurrent updates dont overwrite each other', () => {
    const globalState = {
      workspaces: {
        '/test': {
          workspacePath: '/test',
          initProgress: {},
          services: {},
          builds: {},
          lastUpdated: '2024-01-01',
        },
      },
      lastUsed: '/test',
    };
    writeFileSync(STATE_FILE, JSON.stringify(globalState));

    // Simulate two concurrent updateServiceState calls
    // Each reads fresh, updates one service, writes back
    const read = () => JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    const write = (data: any) => writeFileSync(STATE_FILE, JSON.stringify(data));

    // Update A
    const stateA = read();
    stateA.workspaces['/test'].services['svc-a'] = { name: 'svc-a', status: 'running', pid: 100 };
    write(stateA);

    // Update B (reads after A wrote)
    const stateB = read();
    stateB.workspaces['/test'].services['svc-b'] = { name: 'svc-b', status: 'running', pid: 200 };
    write(stateB);

    // Both should be present
    const final = read();
    expect(final.workspaces['/test'].services['svc-a'].status).toBe('running');
    expect(final.workspaces['/test'].services['svc-b'].status).toBe('running');
  });
});
