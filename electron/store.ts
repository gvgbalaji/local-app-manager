import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { appsJsonPath, stateJsonPath, groupsJsonPath } from './paths';

export type AppType = 'web' | 'desktop';

export interface DetectedPorts {
  rest?: number;
  grpc?: number;
  frontend?: number;
}

export interface AppConfig {
  id: string;
  name: string;
  command: string;
  port: number;
  appType: AppType;
  createdAt: string;
  detectedPorts?: DetectedPorts;
}

export interface GroupConfig {
  id: string;
  name: string;
  appIds: string[];
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
  const apps = readJson<AppConfig[]>(appsJsonPath(), []);
  return apps.map(a => ({ ...a, appType: (a.appType ?? 'web') as AppType }));
}

export function saveApps(apps: AppConfig[]): void {
  writeJson(appsJsonPath(), apps);
}

export function registerApp(input: { name: string; command: string; port: number; appType?: AppType }): AppConfig {
  const apps = listApps();
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
    appType: input.appType ?? 'web',
    createdAt: new Date().toISOString(),
  };
  apps.push(entry);
  saveApps(apps);
  return entry;
}

export function updateApp(
  id: string,
  input: { name: string; command: string; port: number; appType?: AppType }
): AppConfig {
  const apps = listApps();
  const idx = apps.findIndex(a => a.id === id);
  if (idx === -1) throw new Error('App not found');
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
    appType: input.appType ?? apps[idx].appType ?? 'web',
  };
  saveApps(apps);
  return apps[idx];
}

export function deleteApp(id: string): void {
  saveApps(listApps().filter(a => a.id !== id));
  const st = readState();
  delete st[id];
  writeState(st);
  // Remove from any group
  const groups = listGroups();
  for (const g of groups) g.appIds = g.appIds.filter(aid => aid !== id);
  saveGroups(groups);
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

// --- Groups ---

export function listGroups(): GroupConfig[] {
  return readJson<GroupConfig[]>(groupsJsonPath(), []);
}

export function saveGroups(groups: GroupConfig[]): void {
  writeJson(groupsJsonPath(), groups);
}

export function createGroup(name: string): GroupConfig {
  if (!name.trim()) throw new Error('Group name is required');
  const groups = listGroups();
  const group: GroupConfig = {
    id: randomUUID(),
    name: name.trim(),
    appIds: [],
    createdAt: new Date().toISOString(),
  };
  groups.push(group);
  saveGroups(groups);
  return group;
}

export function deleteGroup(id: string): void {
  saveGroups(listGroups().filter(g => g.id !== id));
}

export function addAppToGroup(groupId: string, appId: string): GroupConfig {
  const groups = listGroups();
  // Remove app from any existing group first (an app can only be in one group)
  for (const g of groups) g.appIds = g.appIds.filter(id => id !== appId);
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Group not found');
  group.appIds.push(appId);
  saveGroups(groups);
  return group;
}

export function removeAppFromGroup(groupId: string, appId: string): GroupConfig {
  const groups = listGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Group not found');
  group.appIds = group.appIds.filter(id => id !== appId);
  saveGroups(groups);
  return group;
}

export function renameGroup(id: string, name: string): GroupConfig {
  if (!name.trim()) throw new Error('Group name is required');
  const groups = listGroups();
  const group = groups.find(g => g.id === id);
  if (!group) throw new Error('Group not found');
  group.name = name.trim();
  saveGroups(groups);
  return group;
}

export function setDetectedPorts(id: string, ports: DetectedPorts): void {
  const apps = listApps();
  const app = apps.find(a => a.id === id);
  if (!app) return;
  app.detectedPorts = ports;
  saveApps(apps);
}

export function updateAppPort(id: string, port: number): void {
  const apps = listApps();
  const app = apps.find(a => a.id === id);
  if (!app) return;
  app.port = port;
  saveApps(apps);
}
