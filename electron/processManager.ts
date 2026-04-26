import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { dialog } from 'electron';
import { logFilePath, logBackupPath } from './paths';
import {
  AppConfig,
  listApps,
  readState,
  setStateEntry,
  clearStateEntry,
  setDetectedPorts,
  updateAppPort,
} from './store';
import { readSettings } from './settings';
import { analyzeLogsForPorts, analyzeFailure } from './aiAnalyzer';

const LOG_MAX_BYTES = 10 * 1024 * 1024;

export type AppStatus = 'running' | 'stopped';

export interface AppStatusInfo {
  id: string;
  status: AppStatus;
  startedAt: string | null;
  pid: number | null;
  aiAnalysis?: { reason: string; action: string } | null;
}

export const logEvents = new EventEmitter();

// In-memory failure analysis — cleared on each start
const aiAnalysisMap = new Map<string, { reason: string; action: string }>();

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

// Write a message into the app's own log file so it appears in the DetailPanel log viewer
function appendToAppLog(appId: string, msg: string): void {
  const line = `\n[AI] ${new Date().toISOString()} ${msg}\n`;
  try { fs.appendFileSync(logFilePath(appId), line); } catch { /* ignore */ }
  // Also emit directly in case no tail watcher is running
  logEvents.emit(`log:${appId}`, line);
}

export function statusOf(app: AppConfig): AppStatusInfo {
  const st = readState();
  const entry = st[app.id];
  if (entry && pidAlive(entry.pid)) {
    return { id: app.id, status: 'running', startedAt: entry.startedAt, pid: entry.pid, aiAnalysis: null };
  }
  if (entry) clearStateEntry(app.id);
  return {
    id: app.id, status: 'stopped', startedAt: null, pid: null,
    aiAnalysis: aiAnalysisMap.get(app.id) ?? null,
  };
}

async function doAiAnalysis(app: AppConfig): Promise<void> {
  const log = (msg: string) => appendToAppLog(app.id, msg);
  const settings = readSettings();

  if (!settings.aiEnabled) {
    log('AI analysis skipped: AI is not enabled (enable in Settings)');
    return;
  }
  if (!settings.llmBaseUrl || !settings.llmModel) {
    log('AI analysis skipped: LLM base URL or model not configured (check Settings)');
    return;
  }

  let logs = '';
  try { logs = fs.readFileSync(logFilePath(app.id), 'utf8'); } catch {
    log('AI analysis error: could not read log file');
    return;
  }
  if (!logs.trim()) {
    log('AI analysis skipped: log file is empty');
    return;
  }

  const current = statusOf(app);
  log(`Starting AI analysis — app status: ${current.status}, log size: ${logs.length} chars`);

  if (current.status === 'running') {
    try {
      log('--- Port detection ---');
      const ports = await analyzeLogsForPorts(logs, settings, log);
      const found = Object.entries(ports).filter(([, v]) => v != null);
      if (found.length > 0) {
        setDetectedPorts(app.id, ports);
        log(`Ports saved: ${found.map(([k, v]) => `${k}=${String(v)}`).join(', ')}`);

        if (found.length === 1) {
          // Single port detected — auto-replace silently if different
          const detectedPort = found[0][1] as number;
          if (detectedPort !== app.port) {
            updateAppPort(app.id, detectedPort);
            log(`Auto-replaced port: ${app.port} → ${detectedPort}`);
          } else {
            log(`Detected port ${detectedPort} matches configured port — no change needed`);
          }
        } else if (ports.frontend !== undefined && ports.frontend !== app.port) {
          // Multiple ports detected — ask user only about the frontend port
          log(`Frontend port ${ports.frontend} differs from configured port ${app.port} — asking user...`);
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Keep current'],
            defaultId: 0,
            cancelId: 1,
            title: 'Port Update',
            message: `Replace port for "${app.name}"?`,
            detail: `AI detected the frontend is running on port ${ports.frontend}, but the app is configured with port ${app.port}.\n\nReplace configured port with ${ports.frontend}?`,
          });
          if (response === 0) {
            updateAppPort(app.id, ports.frontend);
            log(`Port replaced: ${app.port} → ${ports.frontend}`);
          } else {
            log(`User kept current port ${app.port}`);
          }
        } else if (ports.frontend !== undefined) {
          log(`Frontend port ${ports.frontend} matches configured port — no change needed`);
        }
      } else {
        log('No ports detected in logs');
      }
    } catch (err) {
      log(`Port detection failed: ${String(err)}`);
    }
  } else {
    try {
      log('--- Failure analysis ---');
      const analysis = await analyzeFailure(logs, settings, log);
      aiAnalysisMap.set(app.id, analysis);
      log(`Failure analysis saved`);
    } catch (err) {
      log(`Failure analysis failed: ${String(err)}`);
    }
  }

  log('AI analysis complete');
}

function scheduleAiAnalysis(app: AppConfig): void {
  setTimeout(() => { void doAiAnalysis(app); }, 20_000);
}

export async function reanalyzeApp(appId: string): Promise<void> {
  const app = listApps().find(a => a.id === appId);
  if (!app) throw new Error('App not found');
  await doAiAnalysis(app);
}

export function startApp(appId: string): AppStatusInfo {
  const app = listApps().find(a => a.id === appId);
  if (!app) throw new Error('App not found');

  const current = statusOf(app);
  if (current.status === 'running') return current;

  if (portBound(app.port)) {
    throw new Error(`Port ${app.port} is already in use by another process (not started by us)`);
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

  const pgid = child.pid;
  child.unref();

  aiAnalysisMap.delete(appId);

  setStateEntry(appId, {
    pid: child.pid,
    pgid,
    startedAt: new Date().toISOString(),
  });

  scheduleAiAnalysis(app);

  return statusOf(app);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function killTreeAndWait(pgid: number, port: number): Promise<boolean> {
  try { process.kill(-pgid, 'SIGTERM'); } catch { /* may already be dead */ }
  for (let i = 0; i < 25; i++) {
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
    throw new Error(`Port ${app.port} is still in use by another process we could not stop`);
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
