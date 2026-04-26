import { useState } from 'react';

interface Props {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export default function CreateGroupDialog({ onClose, onCreate }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    await onCreate(name.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>New Group</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Group name
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Backend services"
            />
            {error && <div className="field-error">{error}</div>}
          </label>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
