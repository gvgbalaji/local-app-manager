import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { appsJsonPath, stateJsonPath } from './paths';

export interface AppConfig {
  id: string;
  name: string;
  command: string;
  port: number;
  createdAt: string;
}

export interface RuntimeEntry {
  pid: number;
  pgid: number;
  startedAt: string;
}

export type StateMap = Record<string, RuntimeEntry>;

function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, data: unknown): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export function listApps(): AppConfig[] {
  return readJson<AppConfig[]>(appsJsonPath(), []);
}

export function saveApps(apps: AppConfig[]): void {
  writeJson(appsJsonPath(), apps);
}

export function registerApp(input: { name: string; command: string; port: number }): AppConfig {
  const apps = listApps();
  if (apps.some(a => a.port === input.port)) {
    throw new Error(`Port ${input.port} is already registered to another app`);
  }
  if (!input.name.trim()) throw new Error('Name is required');
  if (!input.command.trim()) throw new Error('Command is required');
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535');
  }
  const entry: AppConfig = {
    id: randomUUID(),
    name: input.name.trim(),
    command: input.command.trim(),
    port: input.port,
    createdAt: new Date().toISOString(),
  };
  apps.push(entry);
  saveApps(apps);
  return entry;
}

export function updateApp(
  id: string,
  input: { name: string; command: string; port: number }
): AppConfig {
  const apps = listApps();
  const idx = apps.findIndex(a => a.id === id);
  if (idx === -1) throw new Error('App not found');
  if (apps.some(a => a.id !== id && a.port === input.port)) {
    throw new Error(`Port ${input.port} is already registered to another app`);
  }
  if (!input.name.trim()) throw new Error('Name is required');
  if (!input.command.trim()) throw new Error('Command is required');
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535');
  }
  apps[idx] = {
    ...apps[idx],
    name: input.name.trim(),
    command: input.command.trim(),
    port: input.port,
  };
  saveApps(apps);
  return apps[idx];
}

export function deleteApp(id: string): void {
  saveApps(listApps().filter(a => a.id !== id));
  const st = readState();
  delete st[id];
  writeState(st);
}

export function readState(): StateMap {
  return readJson<StateMap>(stateJsonPath(), {});
}

export function writeState(state: StateMap): void {
  writeJson(stateJsonPath(), state);
}

export function setStateEntry(id: string, entry: RuntimeEntry): void {
  const st = readState();
  st[id] = entry;
  writeState(st);
}

export function clearStateEntry(id: string): void {
  const st = readState();
  delete st[id];
  writeState(st);
}
