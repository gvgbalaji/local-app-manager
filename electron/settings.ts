import * as fs from 'fs';
import { settingsJsonPath } from './paths';

export interface Settings {
  aiEnabled: boolean;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
}

const defaults: Settings = {
  aiEnabled: false,
  llmProvider: 'groq',
  llmApiKey: '',
  llmModel: 'llama-3.1-8b-instant',
  llmBaseUrl: 'https://api.groq.com/openai/v1',
};

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsJsonPath(), 'utf8')) as Record<string, unknown>;
    // Migrate from old { groqApiKey } format
    if (typeof raw.groqApiKey === 'string' && !raw.llmApiKey) {
      return {
        ...defaults,
        aiEnabled: Boolean(raw.aiEnabled),
        llmProvider: 'groq',
        llmApiKey: raw.groqApiKey,
      };
    }
    return { ...defaults, ...(raw as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

export function writeSettings(s: Settings): void {
  fs.writeFileSync(settingsJsonPath(), JSON.stringify(s, null, 2));
}
