import type { AppConfig, AppStatusInfo } from '../global';

interface Props {
  apps: AppConfig[];
  statuses: Record<string, AppStatusInfo>;
  onOpen: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 55%))`;
}

export default function GridView({ apps, statuses, onOpen, onStart, onStop, onDelete }: Props): JSX.Element {
  return (
    <div className="grid">
      {apps.map(app => {
        const st = statuses[app.id];
        const running = st?.status === 'running';
        const stop = (e: React.MouseEvent) => e.stopPropagation();
        return (
          <div
            key={app.id}
            className="tile"
            onClick={() => onOpen(app.id)}
            title={`${app.name} — port ${app.port}`}
          >
            <div className="icon" style={{ background: gradientFor(app.name) }}>
              {app.name.charAt(0).toUpperCase()}
            </div>
            <div className="tile-name">{app.name}</div>
            <div className={`status-dot ${running ? 'running' : 'stopped'}`} />
            <div className="tile-actions" onClick={stop}>
              {running ? (
                <button onClick={() => onStop(app.id)} title="Stop">■</button>
              ) : (
                <button onClick={() => onStart(app.id)} title="Start">▶</button>
              )}
              <button onClick={() => onDelete(app.id)} title="Delete" className="danger">🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
