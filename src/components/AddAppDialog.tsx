import { useState } from 'react';
import type { AppConfig, AppType } from '../global';

interface Props {
  editing?: AppConfig | null;
  existingPorts: { id: string; port: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  showError: (e: unknown) => void;
}

export default function AddAppDialog({ editing, existingPorts, onClose, onSaved, showError }: Props): JSX.Element {
  const [name, setName] = useState(editing?.name ?? '');
  const [command, setCommand] = useState(editing?.command ?? '');
  const [port, setPort] = useState(editing ? String(editing.port) : '');
  const [appType, setAppType] = useState<AppType>(editing?.appType ?? 'web');
  const [submitting, setSubmitting] = useState(false);

  const portNum = Number(port);
  const portValid =
    port !== '' && Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  const dupApp = portValid
    ? existingPorts.find(p => p.port === portNum && p.id !== editing?.id)
    : undefined;

  let portError = '';
  if (port !== '' && !portValid) portError = 'Port must be an integer 1–65535';

  const canSave =
    name.trim() !== '' && command.trim() !== '' && portValid && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (dupApp && !confirm(`Port ${portNum} is already used by app "${dupApp.name}". Do you still want to add this app?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const input = { name: name.trim(), command: command.trim(), port: portNum, appType };
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
          Type
          <select value={appType} onChange={e => setAppType(e.target.value as AppType)}>
            <option value="web">Web</option>
            <option value="desktop">Desktop</option>
          </select>
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
          {!portError && dupApp && (
            <span className="field-warn">Port already used by "{dupApp.name}" — you'll be asked to confirm.</span>
          )}
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
