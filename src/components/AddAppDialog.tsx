import { useState } from 'react';
import type { AppConfig } from '../global';

interface Props {
  editing?: AppConfig | null;
  existingPorts: { id: string; port: number }[];
  onClose: () => void;
  onSaved: () => void;
  showError: (e: unknown) => void;
}

export default function AddAppDialog({ editing, existingPorts, onClose, onSaved, showError }: Props): JSX.Element {
  const [name, setName] = useState(editing?.name ?? '');
  const [command, setCommand] = useState(editing?.command ?? '');
  const [port, setPort] = useState(editing ? String(editing.port) : '');
  const [submitting, setSubmitting] = useState(false);

  const portNum = Number(port);
  const portValid =
    port !== '' && Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  const portDup = portValid && existingPorts.some(p => p.port === portNum && p.id !== editing?.id);

  let portError = '';
  if (port !== '' && !portValid) portError = 'Port must be an integer 1–65535';
  else if (portDup) portError = 'Port already registered — use a different port';

  const canSave =
    name.trim() !== '' && command.trim() !== '' && portValid && !portDup && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSubmitting(true);
    try {
      const input = { name: name.trim(), command: command.trim(), port: portNum };
      if (editing) await window.api.update(editing.id, input);
      else await window.api.register(input);
      onSaved();
    } catch (err) {
      showError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>{editing ? 'Edit App' : 'Add App'}</h2>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. api-server"
          />
        </label>
        <label>
          Command
          <input
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="e.g. npm start"
          />
        </label>
        <label>
          Port
          <input
            type="number"
            value={port}
            onChange={e => setPort(e.target.value)}
            placeholder="e.g. 3000"
            min={1}
            max={65535}
          />
          {portError && <span className="field-error">{portError}</span>}
        </label>
        {editing && (
          <p className="hint">
            Note: edits take effect on the next start. A running process keeps running with its original command/port until stopped.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!canSave}>Save</button>
        </div>
      </form>
    </div>
  );
}
