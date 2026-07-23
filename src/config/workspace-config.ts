import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
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
