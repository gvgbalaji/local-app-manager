import { useState } from 'react';
import type { AppConfig, AppStatusInfo, GroupConfig } from '../global';
import GroupFolderTile from './GroupFolderTile';

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 55%))`;
}

interface Props {
  apps: AppConfig[];
  statuses: Record<string, AppStatusInfo>;
  groups: GroupConfig[];
  onOpen: (id: string) => void;
  onInfo: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToGroup: (groupId: string, appId: string) => void;
  onRemoveFromGroup: (groupId: string, appId: string) => void;
  onStartGroup: (groupId: string) => void;
  onStopGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export default function GridView({
  apps, statuses, groups,
  onOpen, onInfo, onStart, onStop, onDelete,
  onAddToGroup, onRemoveFromGroup, onStartGroup, onStopGroup, onDeleteGroup,
}: Props): JSX.Element {
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const groupedAppIds = new Set(groups.flatMap(g => g.appIds));
  const ungroupedApps = apps.filter(a => !groupedAppIds.has(a.id));

  const handleDragStart = (e: React.DragEvent, appId: string) => {
    e.dataTransfer.setData('appId', appId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  };

  const handleDrop = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDragOverGroupId(null);
    const appId = e.dataTransfer.getData('appId');
    if (appId) onAddToGroup(groupId, appId);
  };

  const handleDragLeave = () => setDragOverGroupId(null);

  return (
    <div className="grid" onDragLeave={handleDragLeave}>
      {/* Group folder tiles */}
      {groups.map(group => (
        <GroupFolderTile
          key={group.id}
          group={group}
          apps={apps}
          statuses={statuses}
          onOpen={onOpen}
          onInfo={onInfo}
          onStart={onStart}
          onStop={onStop}
          onRemoveFromGroup={onRemoveFromGroup}
          onStartGroup={onStartGroup}
          onStopGroup={onStopGroup}
          onDeleteGroup={onDeleteGroup}
          onDragOver={e => handleDragOver(e, group.id)}
          onDrop={e => handleDrop(e, group.id)}
          isDragOver={dragOverGroupId === group.id}
        />
      ))}

      {/* Ungrouped app tiles */}
      {ungroupedApps.map(app => {
        const st = statuses[app.id];
        const running = st?.status === 'running';
        return (
          <div
            key={app.id}
            className="tile"
            draggable
            onDragStart={e => handleDragStart(e, app.id)}
            onClick={() => onOpen(app.id)}
            title={`${app.name} — port ${app.port}`}
          >
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
              <button onClick={() => onDelete(app.id)} title="Delete" className="icon-btn danger-soft">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
