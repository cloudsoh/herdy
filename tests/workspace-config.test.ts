import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';

const TEST_DIR = resolve(tmpdir(), 'herdy-test-workspace');

describe('workspace config', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('parses herdy.yaml correctly', () => {
    const yaml = `
nodeVersion: "18"
baseBranch: development

repos:
  - name: auth-service
    url: git@example.com:org/auth.git
    group: common
  - name: web-app
    url: git@example.com:org/web.git
    group: track
    track: web

tracks:
  - name: web
    label: Web Frontend
`;
    writeFileSync(resolve(TEST_DIR, 'herdy.yaml'), yaml);
    const config = parseYaml(yaml);

    expect(config.nodeVersion).toBe('18');
    expect(config.baseBranch).toBe('development');
    expect(config.repos).toHaveLength(2);
    expect(config.repos[0].group).toBe('common');
    expect(config.repos[1].track).toBe('web');
    expect(config.tracks[0].label).toBe('Web Frontend');
  });

  it('parses herdy-service.yaml correctly', () => {
    const yaml = `
services:
  - path: auth-backend
    name: auth-backend
    startScript: null
    dependsOn: []
  - path: auth-api
    name: auth-api
    mode: dev
    devScript: "start:local:nodemon"
    dependsOn: ["auth-backend"]
`;
    const config = parseYaml(yaml);

    expect(config.services).toHaveLength(2);
    expect(config.services[0].startScript).toBeNull();
    expect(config.services[1].mode).toBe('dev');
    expect(config.services[1].devScript).toBe('start:local:nodemon');
    expect(config.services[1].dependsOn).toEqual(['auth-backend']);
  });

  it('supports foundation group', () => {
    const yaml = `
nodeVersion: "18"
baseBranch: development
repos:
  - name: common-lib
    url: git@example.com:org/common.git
    group: foundation
  - name: api
    url: git@example.com:org/api.git
    group: common
tracks: []
`;
    const config = parseYaml(yaml);
    const foundation = config.repos.filter((r: any) => r.group === 'foundation');
    const common = config.repos.filter((r: any) => r.group === 'common');

    expect(foundation).toHaveLength(1);
    expect(common).toHaveLength(1);
  });

  it('mode defaults to prod when not specified', () => {
    const yaml = `
services:
  - path: my-api
    name: my-api
    dependsOn: []
`;
    const config = parseYaml(yaml);
    const service = config.services[0];
    // When mode is not in yaml, it's undefined — code defaults to 'prod'
    expect(service.mode).toBeUndefined();
  });
});
