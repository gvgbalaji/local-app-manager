import * as fs from 'fs';
import { settingsJsonPath } from './paths';

export interface Settings {
  aiEnabled: boolean;
  groqApiKey: string;
}

const defaults: Settings = { aiEnabled: false, groqApiKey: '' };

export function readSettings(): Settings {
  try {
    return { ...defaults, ...(JSON.parse(fs.readFileSync(settingsJsonPath(), 'utf8')) as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

export function writeSettings(s: Settings): void {
  fs.writeFileSync(settingsJsonPath(), JSON.stringify(s, null, 2));
}
