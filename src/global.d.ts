export type AppType = 'web' | 'desktop';

export interface DetectedPorts {
  rest?: number;
  grpc?: number;
  frontend?: number;
}

export interface AppConfig {
  id: string;
  name: string;
  command: string;
  port: number;
  appType: AppType;
  createdAt: string;
  detectedPorts?: DetectedPorts;
}

export interface GroupConfig {
  id: string;
  name: string;
  appIds: string[];
  createdAt: string;
}

export interface AppStatusInfo {
  id: string;
  status: 'running' | 'stopped';
  startedAt: string | null;
  pid: number | null;
  aiAnalysis?: { reason: string; action: string } | null;
}

export interface Settings {
  aiEnabled: boolean;
  groqApiKey: string;
}

export interface Api {
  list(): Promise<{ apps: AppConfig[]; statuses: Record<string, AppStatusInfo>; groups: GroupConfig[] }>;
  register(input: { name: string; command: string; port: number; appType?: AppType }): Promise<AppConfig>;
  update(id: string, input: { name: string; command: string; port: number; appType?: AppType }): Promise<AppConfig>;
  remove(id: string): Promise<boolean>;
  start(id: string): Promise<AppStatusInfo>;
  stop(id: string): Promise<AppStatusInfo>;
  status(id: string): Promise<AppStatusInfo | null>;
  openApp(id: string): Promise<void>;
  createGroup(name: string): Promise<GroupConfig>;
  deleteGroup(id: string): Promise<boolean>;
  renameGroup(id: string, name: string): Promise<GroupConfig>;
  addAppToGroup(groupId: string, appId: string): Promise<GroupConfig>;
  removeAppFromGroup(groupId: string, appId: string): Promise<GroupConfig>;
  startGroup(groupId: string): Promise<AppStatusInfo[]>;
  stopGroup(groupId: string): Promise<AppStatusInfo[]>;
  exportConfig(): Promise<boolean>;
  importConfig(): Promise<boolean>;
  readSettings(): Promise<Settings>;
  writeSettings(s: Settings): Promise<boolean>;
  reanalyze(id: string): Promise<void>;
  subscribeLogs(id: string, onChunk: (chunk: string) => void): Promise<() => void>;
}

declare global {
  interface Window {
    api: Api;
  }
}
