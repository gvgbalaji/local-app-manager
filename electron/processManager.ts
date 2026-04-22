import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { logFilePath, logBackupPath } from './paths';
import {
  AppConfig,
  listApps,
  readState,
  setStateEntry,
  clearStateEntry,
} from './store';

const LOG_MAX_BYTES = 10 * 1024 * 1024;

export type AppStatus = 'running' | 'stopped';

export interface AppStatusInfo {
  id: string;
  status: AppStatus;
  startedAt: string | null;
  pid: number | null;
}

export const logEvents = new EventEmitter();

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portBound(port: number): boolean {
  try {
    const out = execSync(
      `lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`,
      { encoding: 'utf8' }
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function pidOnPort(port: number): number | null {
  try {
    const out = execSync(
      `lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`,
      { encoding: 'utf8' }
    ).trim();
    if (!out) return null;
    const pid = parseInt(out.split('\n')[0], 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function pgidOf(pid: number): number | null {
  try {
    const out = execSync(`ps -o pgid= -p ${pid} 2>/dev/null || true`, {
      encoding: 'utf8',
    }).trim();
    const pgid = parseInt(out, 10);
    return Number.isFinite(pgid) ? pgid : null;
  } catch {
    return null;
  }
}

function rotateIfLarge(file: string, backup: string): void {
  try {
    const st = fs.statSync(file);
    if (st.size >= LOG_MAX_BYTES) {
      try { fs.unlinkSync(backup); } catch { /* ignore */ }
      fs.renameSync(file, backup);
    }
  } catch { /* file may not exist yet */ }
}

export function statusOf(app: AppConfig): AppStatusInfo {
  const st = readState();
  const entry = st[app.id];
  if (entry && pidAlive(entry.pid) && portBound(app.port)) {
    return { id: app.id, status: 'running', startedAt: entry.startedAt, pid: entry.pid };
  }
  if (entry) clearStateEntry(app.id);
  return { id: app.id, status: 'stopped', startedAt: null, pid: null };
}

export function startApp(appId: string): AppStatusInfo {
  const app = listApps().find(a => a.id === appId);
  if (!app) throw new Error('App not found');

  const current = statusOf(app);
  if (current.status === 'running') return current;

  if (portBound(app.port)) {
    throw new Error(
      `Port ${app.port} is already in use by another process (not started by us)`
    );
  }

  const logPath = logFilePath(appId);
  rotateIfLarge(logPath, logBackupPath(appId));

  const out = fs.openSync(logPath, 'a');
  const err = fs.openSync(logPath, 'a');

  const child = spawn('sh', ['-c', app.command], {
    detached: true,
    stdio: ['ignore', out, err],
    env: process.env,
  });

  fs.closeSync(out);
  fs.closeSync(err);

  if (!child.pid) throw new Error('Failed to spawn process');

  // Child is now a session leader (detached + setsid via detached: true on Unix)
  const pgid = child.pid; // with detached: true on Unix, child.pid is the pgid
  child.unref();

  setStateEntry(appId, {
    pid: child.pid,
    pgid,
    startedAt: new Date().toISOString(),
  });

  return statusOf(app);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function killTreeAndWait(pgid: number, port: number): Promise<boolean> {
  try { process.kill(-pgid, 'SIGTERM'); } catch { /* may already be dead */ }
  for (let i = 0; i < 25; i++) { // up to 5s
    await sleep(200);
    if (!portBound(port)) return true;
  }
  try { process.kill(-pgid, 'SIGKILL'); } catch { /* ignore */ }
  await sleep(500);
  return !portBound(port);
}

export async function stopApp(appId: string): Promise<AppStatusInfo> {
  const app = listApps().find(a => a.id === appId);
  if (!app) throw new Error('App not found');

  const st = readState();
  const entry = st[appId];

  let killed = false;

  if (entry && pidAlive(entry.pid)) {
    killed = await killTreeAndWait(entry.pgid, app.port);
  }

  if (!killed && portBound(app.port)) {
    const pid = pidOnPort(app.port);
    if (pid) {
      const pgid = pgidOf(pid) ?? pid;
      killed = await killTreeAndWait(pgid, app.port);
    }
  }

  clearStateEntry(appId);

  if (!killed && portBound(app.port)) {
    throw new Error(
      `Port ${app.port} is still in use by another process we could not stop`
    );
  }

  return statusOf(app);
}

// --- Log tailing ---
const tailers = new Map<string, { watcher: fs.FSWatcher; offset: number }>();

export function startTail(appId: string): { initial: string } {
  const file = logFilePath(appId);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '');
  const stat = fs.statSync(file);
  const start = Math.max(0, stat.size - 64 * 1024);
  const initial = fs.readFileSync(file, 'utf8').slice(start > 0 ? start : 0);
  let offset = stat.size;

  if (tailers.has(appId)) return { initial };

  const watcher = fs.watch(file, { persistent: false }, () => {
    try {
      const s = fs.statSync(file);
      if (s.size < offset) { offset = 0; }
      if (s.size > offset) {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(s.size - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        offset = s.size;
        logEvents.emit(`log:${appId}`, buf.toString('utf8'));
      }
    } catch { /* ignore */ }
  });

  tailers.set(appId, { watcher, offset });
  return { initial };
}

export function stopTail(appId: string): void {
  const t = tailers.get(appId);
  if (t) { t.watcher.close(); tailers.delete(appId); }
}
