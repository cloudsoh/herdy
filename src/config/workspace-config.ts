import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml, YAMLParseError } from 'yaml';
import type { WorkspaceConfig } from '../types.js';
import { resolveWorkspacePath } from './state.js';

function parseYamlSafe(raw: string, filePath: string): WorkspaceConfig {
  try {
    return parseYaml(raw) as WorkspaceConfig;
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const loc = err.linePos?.[0];
      const where = loc ? ` at line ${loc.line}, col ${loc.col}` : '';
      const hint = getYamlHint(err.message);
      throw new Error(
        `herdy.yaml has invalid YAML syntax${where}:\n` +
          `  ${err.message}\n\n` +
          `File: ${filePath}\n` +
          (hint ? `\nHint: ${hint}\n` : '') +
          `\nFix the file and try again.`
      );
    }
    throw err;
  }
}

function getYamlHint(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('compact mapping') || lower.includes('nested mapping')) {
    return (
      'A value containing a colon (e.g. a git URL) may need quoting:\n' +
      '  url: git@gitlab.com:org/repo.git  →  url: "git@gitlab.com:org/repo.git"\n' +
      'Or a list entry may be missing proper indentation under its parent key.'
    );
  }
  if (lower.includes('tab')) {
    return 'YAML does not allow tab characters for indentation — use spaces instead.';
  }
  if (lower.includes('duplicate key')) {
    return 'The same key appears more than once at the same level — remove the duplicate.';
  }
  return '';
}

export function loadWorkspaceConfig(): WorkspaceConfig {
  const workspacePath = resolveWorkspacePath();

  const searchPaths = [
    workspacePath ? resolve(workspacePath, 'herdy.yaml') : '',
    resolve(process.cwd(), 'herdy.yaml'),
  ].filter(Boolean);

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8');
      return parseYamlSafe(raw, configPath);
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
