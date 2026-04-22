import { ipcMain, BrowserWindow } from 'electron';
import { listApps, registerApp, updateApp, deleteApp, AppConfig } from './store';
import {
  startApp,
  stopApp,
  statusOf,
  startTail,
  stopTail,
  logEvents,
  AppStatusInfo,
} from './processManager';

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('apps:list', () => {
    const apps = listApps();
    const statuses: Record<string, AppStatusInfo> = {};
    for (const a of apps) statuses[a.id] = statusOf(a);
    return { apps, statuses };
  });

  ipcMain.handle(
    'apps:register',
    (_e, input: { name: string; command: string; port: number }): AppConfig =>
      registerApp(input)
  );

  ipcMain.handle(
    'apps:update',
    (_e, id: string, input: { name: string; command: string; port: number }): AppConfig =>
      updateApp(id, input)
  );

  ipcMain.handle('apps:delete', (_e, id: string) => {
    deleteApp(id);
    return true;
  });

  ipcMain.handle('apps:start', (_e, id: string) => startApp(id));
  ipcMain.handle('apps:stop', (_e, id: string) => stopApp(id));
  ipcMain.handle('apps:status', (_e, id: string) => {
    const a = listApps().find(x => x.id === id);
    return a ? statusOf(a) : null;
  });

  ipcMain.handle('logs:subscribe', (_e, id: string) => {
    const { initial } = startTail(id);
    const evt = `log:${id}`;
    const listener = (chunk: string) => {
      const w = getWindow();
      if (w && !w.isDestroyed()) w.webContents.send(`logs:chunk:${id}`, chunk);
    };
    logEvents.on(evt, listener);
    const offKey = `logs:unsubscribe:${id}`;
    ipcMain.removeAllListeners(offKey);
    ipcMain.once(offKey, () => {
      logEvents.off(evt, listener);
      stopTail(id);
    });
    return { initial };
  });

  ipcMain.on('logs:unsubscribe', (_e, id: string) => {
    ipcMain.emit(`logs:unsubscribe:${id}`);
  });
}
