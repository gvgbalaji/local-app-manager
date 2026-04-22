export interface AppConfig {
  id: string;
  name: string;
  command: string;
  port: number;
  createdAt: string;
}

export interface AppStatusInfo {
  id: string;
  status: 'running' | 'stopped';
  startedAt: string | null;
  pid: number | null;
}

export interface Api {
  list(): Promise<{ apps: AppConfig[]; statuses: Record<string, AppStatusInfo> }>;
  register(input: { name: string; command: string; port: number }): Promise<AppConfig>;
  remove(id: string): Promise<boolean>;
  start(id: string): Promise<AppStatusInfo>;
  stop(id: string): Promise<AppStatusInfo>;
  status(id: string): Promise<AppStatusInfo | null>;
  subscribeLogs(id: string, onChunk: (chunk: string) => void): Promise<() => void>;
}

declare global {
  interface Window {
    api: Api;
  }
}
