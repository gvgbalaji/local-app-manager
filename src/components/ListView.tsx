import type { AppConfig, AppStatusInfo } from '../global';

interface Props {
  apps: AppConfig[];
  statuses: Record<string, AppStatusInfo>;
  onOpen: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
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

export default function ListView({ apps, statuses, onOpen, onStart, onStop }: Props): JSX.Element {
  return (
    <table className="list">
      <thead>
        <tr>
          <th></th><th>Name</th><th>Port</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {apps.map(app => {
          const st = statuses[app.id];
          const running = st?.status === 'running';
          return (
            <tr key={app.id} onClick={() => onOpen(app.id)}>
              <td><span className={`status-dot ${running ? 'running' : 'stopped'}`} /></td>
              <td>{app.name}</td>
              <td>{app.port}</td>
              <td className={running ? 'running' : 'stopped'}>
                {running ? `● Running ${uptime(st.startedAt)}` : '○ Stopped'}
              </td>
              <td onClick={e => e.stopPropagation()}>
                {running ? (
                  <button onClick={() => onStop(app.id)} title="Stop">■</button>
                ) : (
                  <button onClick={() => onStart(app.id)} title="Start">▶</button>
                )}
                <button onClick={() => onOpen(app.id)} title="Details">📋</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
