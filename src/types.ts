export type ServiceStatus = 'stopped' | 'building' | 'installing' | 'starting' | 'running' | 'error';

export type RepoGroup = 'foundation' | 'common' | 'track';

export interface WorkspaceConfig {
  nodeVersion: string;
  baseBranch: string;
  repos: RepoConfig[];
  tracks: TrackConfig[];
}

export interface RepoConfig {
  name: string;
  url: string;
  group: RepoGroup;
  track?: string;
}

export interface TrackConfig {
  name: string;
  label: string;
}

export type ServiceMode = 'dev' | 'prod';

export interface ServiceConfig {
  path: string;
  name: string;
  startScript: string | null;
  buildScript: string;
  devScript: string;
  mode: ServiceMode;
  dependsOn: string[];
}

export interface RepoServiceConfig {
  services: ServiceConfig[];
}

export interface ServiceState {
  name: string;
  repoName: string;
  path: string;
  status: ServiceStatus;
  pid?: number;
  port?: number;
  error?: string;
  branch?: string;
  behindCount?: number;
}

export interface InitProgress {
  [repoName: string]: {
    cloned: boolean;
    installed: boolean;
    built: boolean;
    envCopied: boolean;
  };
}

export interface BuildRecord {
  [servicePath: string]: {
    commit: string;
    builtAt: string;
  };
}

export interface WorkspaceState {
  workspacePath: string;
  activeTrack?: string;
  initProgress: InitProgress;
  services: { [serviceName: string]: ServiceState };
  builds: BuildRecord;
  lastUpdated: string;
}

export interface GlobalState {
  workspaces: { [workspacePath: string]: WorkspaceState };
  lastUsed: string;
}

export interface GitStatus {
  branch: string;
  behindCount: number;
  aheadCount: number;
  isDirty: boolean;
  fetchFailed: boolean;
}
