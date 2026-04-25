import type { AppConfig, AppStatusInfo } from '../global';

interface Props {
  apps: AppConfig[];
  statuses: Record<string, AppStatusInfo>;
  onOpen: (id: string) => void;
  onInfo: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}

function uptime(startedAt: string | null): string {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function ListView({ apps, statuses, onOpen, onInfo, onStart, onStop, onDelete }: Props): JSX.Element {
  return (
    <table className="list">
      <thead>
        <tr>
          <th></th><th>Name</th><th>Port</th><th>Type</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {apps.map(app => {
          const st = statuses[app.id];
          const running = st?.status === 'running';
          return (
            <tr key={app.id} onClick={() => onOpen(app.id)} style={{ cursor: 'pointer' }}>
              <td><span className={`status-dot ${running ? 'running' : 'stopped'}`} /></td>
              <td>{app.name}</td>
              <td>{app.port}</td>
              <td>{app.appType === 'desktop' ? 'Desktop' : 'Web'}</td>
              <td className={running ? 'running' : 'stopped'}>
                {running ? `● Running ${uptime(st.startedAt)}` : '○ Stopped'}
              </td>
              <td onClick={e => e.stopPropagation()}>
                {running ? (
                  <button onClick={() => onStop(app.id)} title="Stop" className="icon-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                  </button>
                ) : (
                  <button onClick={() => onStart(app.id)} title="Start" className="icon-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                )}
                <button onClick={() => onInfo(app.id)} title="Details" className="icon-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
                </button>
                <button onClick={() => onDelete(app.id)} title="Delete" className="icon-btn danger-soft">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
