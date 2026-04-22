import { useState } from 'react';

interface Props {
  existingPorts: number[];
  onClose: () => void;
  onCreated: () => void;
  showError: (e: unknown) => void;
}

export default function AddAppDialog({ existingPorts, onClose, onCreated, showError }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [port, setPort] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const portNum = Number(port);
  const portValid =
    port !== '' && Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  const portDup = portValid && existingPorts.includes(portNum);

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
      await window.api.register({ name: name.trim(), command: command.trim(), port: portNum });
      onCreated();
    } catch (err) {
      showError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>Add App</h2>
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
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!canSave}>Save</button>
        </div>
      </form>
    </div>
  );
}
