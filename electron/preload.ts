import { contextBridge, ipcRenderer } from 'electron';

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

const api = {
  list: (): Promise<{ apps: AppConfig[]; statuses: Record<string, AppStatusInfo> }> =>
    ipcRenderer.invoke('apps:list'),
  register: (input: { name: string; command: string; port: number }): Promise<AppConfig> =>
    ipcRenderer.invoke('apps:register', input),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke('apps:delete', id),
  start: (id: string): Promise<AppStatusInfo> => ipcRenderer.invoke('apps:start', id),
  stop: (id: string): Promise<AppStatusInfo> => ipcRenderer.invoke('apps:stop', id),
  status: (id: string): Promise<AppStatusInfo | null> => ipcRenderer.invoke('apps:status', id),
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
