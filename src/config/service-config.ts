import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { RepoServiceConfig, ServiceConfig } from '../types.js';

const DEFAULT_SERVICE_CONFIG: Omit<ServiceConfig, 'path' | 'name'> = {
  startScript: 'start',
  buildScript: 'build',
  devScript: 'start:dev',
  mode: 'prod',
  dependsOn: [],
};

export function loadRepoServiceConfig(repoPath: string): RepoServiceConfig | null {
  const configPath = resolve(repoPath, 'herdy-service.yaml');
  if (!existsSync(configPath)) {
    return null;
  }
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parseYaml(raw) as { services?: Partial<ServiceConfig>[] };

  if (!parsed.services || !Array.isArray(parsed.services)) {
    return null;
  }

  const services: ServiceConfig[] = parsed.services.map((s) => ({
    ...DEFAULT_SERVICE_CONFIG,
    path: s.path || '',
    name: s.name || s.path || '',
    ...s,
  }));

  return { services };
}

export const SERVICE_TYPES = ['api', 'web', 'cron', 'mq', 'ws'] as const;
export type ServiceType = typeof SERVICE_TYPES[number];

export function getServiceType(serviceName: string): ServiceType | null {
  for (const type of SERVICE_TYPES) {
    if (serviceName.endsWith(`-${type}`) || serviceName === type) {
      return type;
    }
  }
  return null;
}

export function discoverServices(repoPath: string, repoName: string): ServiceConfig[] {
  const config = loadRepoServiceConfig(repoPath);
  if (config) {
    return config.services;
  }

  // Fallback: scan for subdirectories with package.json
  const entries = readdirSync(repoPath);
  const services: ServiceConfig[] = [];

  for (const entry of entries) {
    const entryPath = resolve(repoPath, entry);
    const pkgPath = resolve(entryPath, 'package.json');
    if (statSync(entryPath).isDirectory() && existsSync(pkgPath)) {
      services.push({
        ...DEFAULT_SERVICE_CONFIG,
        path: entry,
        name: `${repoName}-${entry}`,
      });
    }
  }

  return services;
}
