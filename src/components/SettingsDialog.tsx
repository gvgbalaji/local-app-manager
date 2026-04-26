import { useEffect, useState } from 'react';
import type { Settings } from '../global';

interface Provider {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  keyLabel: string;
  hint?: string;
}

const PROVIDERS: Provider[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    needsKey: true,
    keyLabel: 'Groq API Key',
    hint: 'Get your key at console.groq.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    keyLabel: 'OpenAI API Key',
    hint: 'Get your key at platform.openai.com',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
    keyLabel: '',
    hint: 'Requires Ollama running locally (ollama.ai)',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    needsKey: true,
    keyLabel: 'Mistral API Key',
    hint: 'Get your key at console.mistral.ai',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    needsKey: true,
    keyLabel: 'Together AI API Key',
    hint: 'Get your key at api.together.ai',
  },
  {
    id: 'litellm',
    label: 'LiteLLM Proxy',
    baseUrl: 'http://localhost:4000',
    defaultModel: 'gpt-4o-mini',
    needsKey: false,
    keyLabel: 'API Key (optional)',
    hint: 'Run: litellm --config config.yaml (supports 100+ providers)',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    defaultModel: '',
    needsKey: true,
    keyLabel: 'API Key',
    hint: 'Any OpenAI-compatible endpoint',
  },
];

interface Props {
  onClose: () => void;
}

export default function SettingsDialog({ onClose }: Props): JSX.Element {
  const [settings, setSettings] = useState<Settings>({
    aiEnabled: false,
    llmProvider: 'groq',
    llmApiKey: '',
    llmModel: 'llama-3.1-8b-instant',
    llmBaseUrl: 'https://api.groq.com/openai/v1',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.readSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const currentProvider = PROVIDERS.find(p => p.id === settings.llmProvider) ?? PROVIDERS[PROVIDERS.length - 1];

  const handleProviderChange = (providerId: string) => {
    const p = PROVIDERS.find(pr => pr.id === providerId);
    if (!p) return;
    setSettings(s => ({
      ...s,
      llmProvider: providerId,
      llmBaseUrl: p.baseUrl,
      llmModel: p.defaultModel,
      // Clear key when switching to providers that don't need one
      llmApiKey: p.needsKey ? s.llmApiKey : '',
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await window.api.writeSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return (
    <div className="modal-backdrop">
      <div className="modal"><p style={{ margin: 0, color: 'var(--muted)' }}>Loading…</p></div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>

        <form onSubmit={handleSave}>
          {/* AI toggle */}
          <div className="settings-section">
            <div className="settings-section-title">AI Log Analysis</div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.aiEnabled}
                onChange={e => setSettings(s => ({ ...s, aiEnabled: e.target.checked }))}
              />
              Enable AI analysis
            </label>
            <p className="hint">20 s after start: detects ports from logs and diagnoses failures. Results stream into the Detail Panel log viewer.</p>
          </div>

          {settings.aiEnabled && (
            <>
              {/* Provider picker */}
              <div className="settings-section">
                <div className="settings-section-title">LLM Provider</div>
                <div className="provider-grid">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`provider-btn${settings.llmProvider === p.id ? ' active' : ''}`}
                      onClick={() => handleProviderChange(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {currentProvider.hint && (
                  <p className="hint">{currentProvider.hint}</p>
                )}
              </div>

              {/* Model */}
              <label>
                Model
                <input
                  value={settings.llmModel}
                  onChange={e => setSettings(s => ({ ...s, llmModel: e.target.value }))}
                  placeholder="e.g. llama-3.1-8b-instant"
                />
              </label>

              {/* Base URL */}
              <label>
                Base URL
                <input
                  value={settings.llmBaseUrl}
                  onChange={e => setSettings(s => ({ ...s, llmBaseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                />
              </label>

              {/* API Key (hidden for Ollama) */}
              {(currentProvider.needsKey || currentProvider.id === 'litellm') && (
                <label>
                  {currentProvider.keyLabel || 'API Key'}
                  <input
                    type="password"
                    value={settings.llmApiKey}
                    onChange={e => setSettings(s => ({ ...s, llmApiKey: e.target.value }))}
                    placeholder={currentProvider.needsKey ? 'Required' : 'Optional'}
                    autoComplete="off"
                  />
                </label>
              )}
            </>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              style={{
                background: saved ? 'var(--green)' : undefined,
                color: saved ? '#1e1e2e' : undefined,
                borderColor: saved ? 'var(--green)' : undefined,
              }}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
