import { useEffect, useState } from 'react';
import type { Settings } from '../global';

interface Props {
  onClose: () => void;
}

export default function SettingsDialog({ onClose }: Props): JSX.Element {
  const [settings, setSettings] = useState<Settings>({ aiEnabled: false, groqApiKey: '' });
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
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>
        <form onSubmit={handleSave}>
          <div className="settings-section">
            <div className="settings-section-title">AI Analysis (Groq)</div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.aiEnabled}
                onChange={e => setSettings(s => ({ ...s, aiEnabled: e.target.checked }))}
              />
              Enable AI log analysis
            </label>
            <p className="hint">When enabled, Groq LLM analyzes logs 20s after start to detect ports and diagnose failures.</p>
          </div>

          {settings.aiEnabled && (
            <label>
              Groq API Key
              <input
                type="password"
                value={settings.groqApiKey}
                onChange={e => setSettings(s => ({ ...s, groqApiKey: e.target.value }))}
                placeholder="gsk_..."
                autoComplete="off"
              />
            </label>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" style={{ background: saved ? 'var(--green)' : undefined, color: saved ? '#1e1e2e' : undefined }}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
