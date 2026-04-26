import { contextBridge, ipcRenderer } from 'electron';

export type AppType = 'web' | 'desktop';

export interface AppConfig {
  id: string;
  name: string;
  command: string;
  port: number;
  appType: AppType;
  createdAt: string;
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
}

const api = {
  list: (): Promise<{ apps: AppConfig[]; statuses: Record<string, AppStatusInfo>; groups: GroupConfig[] }> =>
    ipcRenderer.invoke('apps:list'),
  register: (input: { name: string; command: string; port: number; appType?: AppType }): Promise<AppConfig> =>
    ipcRenderer.invoke('apps:register', input),
  update: (id: string, input: { name: string; command: string; port: number; appType?: AppType }): Promise<AppConfig> =>
    ipcRenderer.invoke('apps:update', id, input),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke('apps:delete', id),
  start: (id: string): Promise<AppStatusInfo> => ipcRenderer.invoke('apps:start', id),
  stop: (id: string): Promise<AppStatusInfo> => ipcRenderer.invoke('apps:stop', id),
  status: (id: string): Promise<AppStatusInfo | null> => ipcRenderer.invoke('apps:status', id),
  openApp: (id: string): Promise<void> => ipcRenderer.invoke('apps:open', id),

  // Groups
  createGroup: (name: string): Promise<GroupConfig> => ipcRenderer.invoke('groups:create', name),
  deleteGroup: (id: string): Promise<boolean> => ipcRenderer.invoke('groups:delete', id),
  renameGroup: (id: string, name: string): Promise<GroupConfig> => ipcRenderer.invoke('groups:rename', id, name),
  addAppToGroup: (groupId: string, appId: string): Promise<GroupConfig> =>
    ipcRenderer.invoke('groups:add-app', groupId, appId),
  removeAppFromGroup: (groupId: string, appId: string): Promise<GroupConfig> =>
    ipcRenderer.invoke('groups:remove-app', groupId, appId),
  startGroup: (groupId: string): Promise<AppStatusInfo[]> => ipcRenderer.invoke('groups:start', groupId),
  stopGroup: (groupId: string): Promise<AppStatusInfo[]> => ipcRenderer.invoke('groups:stop', groupId),

  // Config
  exportConfig: (): Promise<boolean> => ipcRenderer.invoke('config:export'),
  importConfig: (): Promise<boolean> => ipcRenderer.invoke('config:import'),

  // Settings
  readSettings: (): Promise<{ aiEnabled: boolean; groqApiKey: string }> =>
    ipcRenderer.invoke('settings:read'),
  writeSettings: (s: { aiEnabled: boolean; groqApiKey: string }): Promise<boolean> =>
    ipcRenderer.invoke('settings:write', s),

  // AI
  reanalyze: (id: string): Promise<void> => ipcRenderer.invoke('ai:reanalyze', id),

  subscribeLogs: (id: string, onChunk: (chunk: string) => void): Promise<() => void> => {
    const channel = `logs:chunk:${id}`;
    const listener = (_: unknown, chunk: string) => onChunk(chunk);
    ipcRenderer.on(channel, listener);
    return ipcRenderer.invoke('logs:subscribe', id).then((res: { initial: string }) => {
      if (res.initial) onChunk(res.initial);
      return () => {
        ipcRenderer.removeListener(channel, listener);
        ipcRenderer.send('logs:unsubscribe', id);
      };
    });
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
