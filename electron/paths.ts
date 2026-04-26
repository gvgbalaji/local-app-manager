import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function configDir(): string {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dataDir(): string {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function logsDir(): string {
  const dir = path.join(dataDir(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function appsJsonPath(): string {
  return path.join(configDir(), 'apps.json');
}

export function stateJsonPath(): string {
  return path.join(dataDir(), 'state.json');
}

export function groupsJsonPath(): string {
  return path.join(configDir(), 'groups.json');
}

export function settingsJsonPath(): string {
  return path.join(configDir(), 'settings.json');
}

export function logFilePath(appId: string): string {
  return path.join(logsDir(), `${appId}.log`);
}

export function logBackupPath(appId: string): string {
  return path.join(logsDir(), `${appId}.log.1`);
}
