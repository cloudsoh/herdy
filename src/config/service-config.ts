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

export function getServiceType(name: string): string | null {
  const lastDash = name.lastIndexOf('-');
  if (lastDash === -1) return null;
  const suffix = name.slice(lastDash + 1);
  return (SERVICE_TYPES as readonly string[]).includes(suffix) ? suffix : null;
}

export function deriveServiceType(service: ServiceConfig): string {
  if (service.serviceType) return service.serviceType;
  const lastDash = service.name.lastIndexOf('-');
  return lastDash !== -1 ? service.name.slice(lastDash + 1) : service.name;
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
