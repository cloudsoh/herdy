import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { WorkspaceConfig } from '../types.js';
import { resolveWorkspacePath } from './state.js';

export function loadWorkspaceConfig(): WorkspaceConfig {
  const workspacePath = resolveWorkspacePath();

  const searchPaths = [
    workspacePath ? resolve(workspacePath, 'herdy.yaml') : '',
    resolve(process.cwd(), 'herdy.yaml'),
  ].filter(Boolean);

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8');
      return parseYaml(raw) as WorkspaceConfig;
    }
  }

  throw new Error(
    `herdy.yaml not found. Create one in your workspace root.\n` +
    `Searched: ${searchPaths.join(', ')}`
  );
}

export function resolveConfigPath(): string {
  const workspacePath = resolveWorkspacePath();
  const searchPaths = [
    workspacePath ? resolve(workspacePath, 'herdy.yaml') : '',
    resolve(process.cwd(), 'herdy.yaml'),
  ].filter(Boolean);

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) return configPath;
  }

  throw new Error(`herdy.yaml not found. Searched: ${searchPaths.join(', ')}`);
}

export const SETTABLE_KEYS = ['baseBranch', 'nodeVersion'] as const;
export type SettableKey = typeof SETTABLE_KEYS[number];

export function setWorkspaceConfig(key: SettableKey, value: string): void {
  const configPath = resolveConfigPath();
  const config = loadWorkspaceConfig();
  config[key] = value;
  writeFileSync(configPath, stringifyYaml(config));
}
