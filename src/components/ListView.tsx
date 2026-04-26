import type { AppConfig, AppStatusInfo, GroupConfig } from '../global';

interface Props {
  apps: AppConfig[];
  statuses: Record<string, AppStatusInfo>;
  groups: GroupConfig[];
  onOpen: (id: string) => void;
  onInfo: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onStartGroup: (groupId: string) => void;
  onStopGroup: (groupId: string) => void;
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

function AppRow({ app, statuses, onOpen, onInfo, onStart, onStop, onDelete, nested }: {
  app: AppConfig;
  statuses: Record<string, AppStatusInfo>;
  onOpen: (id: string) => void;
  onInfo: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  nested?: boolean;
}): JSX.Element {
  const st = statuses[app.id];
  const running = st?.status === 'running';
  return (
    <tr onClick={() => onOpen(app.id)} className={nested ? 'list-nested-row' : ''}>
      <td>
        {nested && <span className="list-tree-connector" />}
        <span className={`status-dot ${running ? 'running' : 'stopped'}`} />
      </td>
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
}

export default function ListView({ apps, statuses, groups, onOpen, onInfo, onStart, onStop, onDelete, onStartGroup, onStopGroup }: Props): JSX.Element {
  const groupedAppIds = new Set(groups.flatMap(g => g.appIds));
  const ungroupedApps = apps.filter(a => !groupedAppIds.has(a.id));

  return (
    <table className="list">
      <thead>
        <tr>
          <th></th><th>Name</th><th>Port</th><th>Type</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(group => {
          const groupApps = group.appIds.map(id => apps.find(a => a.id === id)).filter(Boolean) as AppConfig[];
          const anyRunning = groupApps.some(a => statuses[a.id]?.status === 'running');
          return [
            <tr key={`group-${group.id}`} className="list-group-header">
              <td colSpan={5} className="list-group-name">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {group.name}
                <span className="list-group-count">{groupApps.length} app{groupApps.length !== 1 ? 's' : ''}</span>
              </td>
              <td onClick={e => e.stopPropagation()}>
                {anyRunning ? (
                  <button onClick={() => onStopGroup(group.id)} title="Stop all" className="icon-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                  </button>
                ) : (
                  <button onClick={() => onStartGroup(group.id)} title="Start all" className="icon-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                )}
              </td>
            </tr>,
            ...groupApps.map((app) => (
              <AppRow
                key={app.id}
                app={app}
                statuses={statuses}
                onOpen={onOpen}
                onInfo={onInfo}
                onStart={onStart}
                onStop={onStop}
                onDelete={onDelete}
                nested
              />
            )),
          ];
        })}
        {ungroupedApps.map(app => (
          <AppRow key={app.id} app={app} statuses={statuses} onOpen={onOpen} onInfo={onInfo} onStart={onStart} onStop={onStop} onDelete={onDelete} />
        ))}
      </tbody>
    </table>
  );
}
