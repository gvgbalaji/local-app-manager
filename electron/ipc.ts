import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import { exec } from 'child_process';
import * as fs from 'fs';
import {
  listApps, registerApp, updateApp, deleteApp, AppConfig, readState,
  listGroups, createGroup, deleteGroup, addAppToGroup, removeAppFromGroup, renameGroup,
  saveApps, saveGroups,
} from './store';
import { readSettings, writeSettings, Settings } from './settings';
import {
  startApp,
  stopApp,
  statusOf,
  startTail,
  stopTail,
  logEvents,
  reanalyzeApp,
  AppStatusInfo,
} from './processManager';

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('apps:list', () => {
    const apps = listApps();
    const statuses: Record<string, AppStatusInfo> = {};
    for (const a of apps) statuses[a.id] = statusOf(a);
    const groups = listGroups();
    return { apps, statuses, groups };
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

  // --- Groups ---

  ipcMain.handle('groups:create', (_e, name: string) => createGroup(name));

  ipcMain.handle('groups:delete', (_e, id: string) => {
    deleteGroup(id);
    return true;
  });

  ipcMain.handle('groups:rename', (_e, id: string, name: string) => renameGroup(id, name));

  ipcMain.handle('groups:add-app', (_e, groupId: string, appId: string) =>
    addAppToGroup(groupId, appId)
  );

  ipcMain.handle('groups:remove-app', (_e, groupId: string, appId: string) =>
    removeAppFromGroup(groupId, appId)
  );

  ipcMain.handle('groups:start', async (_e, groupId: string) => {
    const group = listGroups().find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');
    const results: AppStatusInfo[] = [];
    for (const appId of group.appIds) {
      try { results.push(await startApp(appId)); } catch { /* ignore individual failures */ }
    }
    return results;
  });

  ipcMain.handle('groups:stop', async (_e, groupId: string) => {
    const group = listGroups().find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');
    const results: AppStatusInfo[] = [];
    for (const appId of group.appIds) {
      try { results.push(await stopApp(appId)); } catch { /* ignore individual failures */ }
    }
    return results;
  });

  // --- Config export / import ---

  ipcMain.handle('config:export', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'local-app-manager-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    const data = { version: 1, apps: listApps(), groups: listGroups() };
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    return true;
  });

  ipcMain.handle('config:import', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return false;
    const raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')) as {
      apps?: unknown;
      groups?: unknown;
    };
    if (!raw.apps || !Array.isArray(raw.apps)) throw new Error('Invalid config file: missing apps array');
    saveApps(raw.apps as Parameters<typeof saveApps>[0]);
    saveGroups(Array.isArray(raw.groups) ? raw.groups as Parameters<typeof saveGroups>[0] : []);
    return true;
  });

  // --- Settings ---

  ipcMain.handle('settings:read', () => readSettings());
  ipcMain.handle('settings:write', (_e, s: Settings) => { writeSettings(s); return true; });

  // --- AI ---

  ipcMain.handle('ai:reanalyze', (_e, id: string) => reanalyzeApp(id));

  // --- Logs ---

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
