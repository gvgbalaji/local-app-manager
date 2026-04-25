import { useEffect, useRef, useState } from 'react';
import type { AppConfig, AppStatusInfo } from '../global';

interface Props {
  app: AppConfig;
  status: AppStatusInfo | undefined;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export default function DetailPanel({ app, status, onClose, onStart, onStop, onDelete, onEdit }: Props): JSX.Element {
  const [logs, setLogs] = useState('');
  const [pinBottom, setPinBottom] = useState(true);
  const logsRef = useRef<HTMLPreElement | null>(null);

  const running = status?.status === 'running';

  useEffect(() => {
    setLogs('');
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    window.api.subscribeLogs(app.id, (chunk) => {
      if (cancelled) return;
      setLogs(prev => (prev + chunk).slice(-500_000));
    }).then(u => { if (cancelled) u(); else unsubscribe = u; });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [app.id]);

  useEffect(() => {
    if (pinBottom && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, pinBottom]);

  return (
    <div className="slideover">
      <div className="slideover-header">
        <h2>{app.name}</h2>
        <button onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="slideover-body">
        <div className="field"><label>Command</label><code>{app.command}</code></div>
        <div className="field"><label>Port</label><code>{app.port}</code></div>
        <div className="field"><label>Type</label><code>{app.appType === 'desktop' ? 'Desktop' : 'Web'}</code></div>
        <div className="field">
          <label>Status</label>
          <span className={running ? 'running' : 'stopped'}>
            {running ? `● Running (pid ${status?.pid})` : '○ Stopped'}
          </span>
        </div>
        <div className="actions">
          {running
            ? <button onClick={onStop}>Stop</button>
            : <button onClick={onStart}>Start</button>}
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete} className="danger">Delete</button>
        </div>
        <div className="logs-header">
          <strong>Logs</strong>
          <label className="pin">
            <input type="checkbox" checked={pinBottom} onChange={e => setPinBottom(e.target.checked)} />
            Pin to bottom
          </label>
          <button onClick={() => setLogs('')}>Clear view</button>
        </div>
        <pre className="logs" ref={logsRef}>{logs}</pre>
      </div>
    </div>
  );
}
