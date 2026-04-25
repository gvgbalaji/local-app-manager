import { ipcMain, BrowserWindow, shell } from 'electron';
import { exec } from 'child_process';
import { listApps, registerApp, updateApp, deleteApp, AppConfig, readState } from './store';
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

  ipcMain.handle('apps:open', (_e, id: string) => {
    const app = listApps().find(a => a.id === id);
    if (!app) return;
    const status = statusOf(app);
    if (status.status !== 'running') return;
    if (app.appType === 'desktop') {
      const entry = readState()[id];
      if (!entry?.pid) return;
      // Desktop apps often call setsid() and break out of the stored process group.
      // Recursively walk the process tree from the stored PID to find all descendants,
      // then try wmctrl (GNOME-friendly, handles minimized windows) then xdotool.
      const script = `
get_descendants() {
  echo $1
  pgrep -P $1 2>/dev/null | while read c; do get_descendants $c; done
}
PIDS=$(get_descendants ${entry.pid})
if command -v wmctrl &>/dev/null; then
  for p in $PIDS; do
    WID=$(wmctrl -lp 2>/dev/null | awk -v pid=$p '$3==pid {print $1; exit}')
    if [ -n "$WID" ]; then wmctrl -i -a "$WID"; exit 0; fi
  done
fi
if command -v xdotool &>/dev/null; then
  for p in $PIDS; do
    WID=$(xdotool search --pid $p 2>/dev/null | head -1)
    if [ -n "$WID" ]; then xdotool windowmap "$WID" windowactivate --sync "$WID"; exit 0; fi
  done
fi
`;
      exec(script, { shell: '/bin/bash' });
    } else {
      shell.openExternal(`http://localhost:${app.port}`);
    }
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
