import { useState } from 'react';
import type { AppConfig, AppStatusInfo, GroupConfig } from '../global';
import GroupExpansionModal from './GroupExpansionModal';

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
  onOpen: (id: string) => void;
  onInfo: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemoveFromGroup: (groupId: string, appId: string) => void;
  onStartGroup: (groupId: string) => void;
  onStopGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
}

export default function GroupFolderTile({
  group, apps, statuses,
  onOpen, onInfo, onStart, onStop,
  onRemoveFromGroup, onStartGroup, onStopGroup, onDeleteGroup,
  onDragOver, onDrop, isDragOver,
}: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const groupApps = group.appIds
    .map(id => apps.find(a => a.id === id))
    .filter(Boolean) as AppConfig[];

  const previewApps = groupApps.slice(0, 4);
  const anyRunning = groupApps.some(a => statuses[a.id]?.status === 'running');

  return (
    <>
      <div
        className={`tile folder-tile${isDragOver ? ' drag-over' : ''}`}
        onClick={() => setExpanded(true)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        title={`${group.name} (${groupApps.length} apps)`}
      >
        <div className="folder-icon">
          <div className="folder-grid">
            {previewApps.map(app => (
              <div
                key={app.id}
                className="folder-mini-icon"
                style={{ background: gradientFor(app.name) }}
                title={app.name}
              >
                {app.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {previewApps.length === 0 && (
              <div className="folder-empty-hint">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
            )}
          </div>
          {anyRunning && <div className="folder-running-dot" />}
        </div>
        <div className="tile-name">{group.name}</div>
        <div className="tile-port">{groupApps.length} app{groupApps.length !== 1 ? 's' : ''}</div>
        <div className="tile-actions" onClick={e => e.stopPropagation()}>
          {anyRunning ? (
            <button onClick={() => onStopGroup(group.id)} title="Stop all" className="icon-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            </button>
          ) : (
            <button onClick={() => onStartGroup(group.id)} title="Start all" className="icon-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          )}
          <button onClick={() => onDeleteGroup(group.id)} title="Delete group" className="icon-btn danger-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <GroupExpansionModal
          group={group}
          apps={apps}
          statuses={statuses}
          onClose={() => setExpanded(false)}
          onOpen={onOpen}
          onInfo={onInfo}
          onStart={onStart}
          onStop={onStop}
          onRemoveFromGroup={onRemoveFromGroup}
          onStartGroup={onStartGroup}
          onStopGroup={onStopGroup}
        />
      )}
    </>
  );
}
