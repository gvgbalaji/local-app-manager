import { useEffect } from 'react';
import type { AppConfig, AppStatusInfo, GroupConfig } from '../global';

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 55%))`;
}

interface Props {
  group: GroupConfig;
  apps: AppConfig[];
  statuses: Record<string, AppStatusInfo>;
  onClose: () => void;
  onOpen: (id: string) => void;
  onInfo: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemoveFromGroup: (groupId: string, appId: string) => void;
  onStartGroup: (groupId: string) => void;
  onStopGroup: (groupId: string) => void;
}

export default function GroupExpansionModal({
  group, apps, statuses, onClose, onOpen, onInfo,
  onStart, onStop, onRemoveFromGroup, onStartGroup, onStopGroup,
}: Props): JSX.Element {
  const groupApps = group.appIds.map(id => apps.find(a => a.id === id)).filter(Boolean) as AppConfig[];
  const anyRunning = groupApps.some(a => statuses[a.id]?.status === 'running');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="group-modal" onClick={e => e.stopPropagation()}>
        <div className="group-modal-header">
          <h2>{group.name}</h2>
          <div className="group-modal-actions">
            {anyRunning ? (
              <button className="icon-btn" title="Stop all" onClick={() => onStopGroup(group.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              </button>
            ) : (
              <button className="icon-btn" title="Start all" onClick={() => onStartGroup(group.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            )}
            <button className="icon-btn" onClick={onClose} title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div className="group-modal-body">
          {groupApps.length === 0 ? (
            <p className="group-empty">No apps in this group yet. Drag apps onto the folder to add them.</p>
          ) : (
            <div className="group-modal-grid">
              {groupApps.map(app => {
                const st = statuses[app.id];
                const running = st?.status === 'running';
                return (
                  <div key={app.id} className="tile" onClick={() => onOpen(app.id)} title={`${app.name} — port ${app.port}`}>
                    <div className="icon" style={{ background: gradientFor(app.name) }}>
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="tile-name">{app.name}</div>
                    <div className="tile-port">:{app.port}</div>
                    <div className={`status-dot ${running ? 'running' : 'stopped'}`} />
                    <div className="tile-actions" onClick={e => e.stopPropagation()}>
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
                      <button onClick={() => onRemoveFromGroup(group.id, app.id)} title="Remove from group" className="icon-btn danger-soft">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
