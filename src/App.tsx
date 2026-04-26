import { useCallback, useEffect, useState } from 'react';
import type { AppConfig, AppStatusInfo, GroupConfig } from './global';
import Header from './components/Header';
import GridView from './components/GridView';
import ListView from './components/ListView';
import AddAppDialog from './components/AddAppDialog';
import DetailPanel from './components/DetailPanel';
import CreateGroupDialog from './components/CreateGroupDialog';
import SettingsDialog from './components/SettingsDialog';

export type ViewMode = 'grid' | 'list';

export default function App(): JSX.Element {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AppStatusInfo>>({});
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [view, setView] = useState<ViewMode>(
    (localStorage.getItem('view') as ViewMode) || 'grid'
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await window.api.list();
    setApps(res.apps);
    setStatuses(res.statuses);
    setGroups(res.groups);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => { localStorage.setItem('view', view); }, [view]);

  const selected = apps.find(a => a.id === selectedId) ?? null;

  const showError = (e: unknown) => {
    setToast(e instanceof Error ? e.message : String(e));
    setTimeout(() => setToast(null), 4000);
  };

  const onStart = async (id: string) => {
    try { await window.api.start(id); await reload(); } catch (e) { showError(e); }
  };
  const onStop = async (id: string) => {
    try { await window.api.stop(id); await reload(); } catch (e) { showError(e); }
  };
  const onOpen = async (id: string) => {
    try { await window.api.openApp(id); } catch (e) { showError(e); }
  };

  const onDelete = async (id: string) => {
    const isRunning = statuses[id]?.status === 'running';
    const msg = isRunning ? 'This app is running. Stop it and delete?' : 'Delete this app?';
    if (!confirm(msg)) return;
    try {
      if (isRunning) {
        try { await window.api.stop(id); } catch (e) { showError(e); return; }
      }
      await window.api.remove(id);
      if (selectedId === id) setSelectedId(null);
      await reload();
    } catch (e) { showError(e); }
  };

  const onCreateGroup = async (name: string) => {
    try { await window.api.createGroup(name); await reload(); } catch (e) { showError(e); }
  };

  const onDeleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Apps will not be deleted.')) return;
    try { await window.api.deleteGroup(id); await reload(); } catch (e) { showError(e); }
  };

  const onAddToGroup = async (groupId: string, appId: string) => {
    try { await window.api.addAppToGroup(groupId, appId); await reload(); } catch (e) { showError(e); }
  };

  const onRemoveFromGroup = async (groupId: string, appId: string) => {
    try { await window.api.removeAppFromGroup(groupId, appId); await reload(); } catch (e) { showError(e); }
  };

  const onStartGroup = async (groupId: string) => {
    try { await window.api.startGroup(groupId); await reload(); } catch (e) { showError(e); }
  };

  const onStopGroup = async (groupId: string) => {
    try { await window.api.stopGroup(groupId); await reload(); } catch (e) { showError(e); }
  };

  const onExport = async () => {
    try { await window.api.exportConfig(); } catch (e) { showError(e); }
  };

  const onImport = async () => {
    try {
      const ok = await window.api.importConfig();
      if (ok) await reload();
    } catch (e) { showError(e); }
  };

  return (
    <div className="app">
      <Header
        view={view}
        onViewChange={setView}
        onAdd={() => setAddOpen(true)}
        onCreateGroup={() => setCreateGroupOpen(true)}
        onExport={onExport}
        onImport={onImport}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="content">
        {apps.length === 0 && groups.length === 0 ? (
          <div className="empty">
            <p>No apps yet.</p>
            <button onClick={() => setAddOpen(true)}>+ Add your first app</button>
          </div>
        ) : view === 'grid' ? (
          <GridView
            apps={apps}
            statuses={statuses}
            groups={groups}
            onOpen={onOpen}
            onInfo={setSelectedId}
            onStart={onStart}
            onStop={onStop}
            onDelete={onDelete}
            onAddToGroup={onAddToGroup}
            onRemoveFromGroup={onRemoveFromGroup}
            onStartGroup={onStartGroup}
            onStopGroup={onStopGroup}
            onDeleteGroup={onDeleteGroup}
          />
        ) : (
          <ListView
            apps={apps}
            statuses={statuses}
            groups={groups}
            onOpen={onOpen}
            onInfo={setSelectedId}
            onStart={onStart}
            onStop={onStop}
            onDelete={onDelete}
            onStartGroup={onStartGroup}
            onStopGroup={onStopGroup}
          />
        )}
      </main>

      {(addOpen || editingId) && (
        <AddAppDialog
          editing={editingId ? apps.find(a => a.id === editingId) ?? null : null}
          existingPorts={apps.map(a => ({ id: a.id, port: a.port, name: a.name }))}
          onClose={() => { setAddOpen(false); setEditingId(null); }}
          onSaved={async () => { setAddOpen(false); setEditingId(null); await reload(); }}
          showError={showError}
        />
      )}

      {createGroupOpen && (
        <CreateGroupDialog
          onClose={() => setCreateGroupOpen(false)}
          onCreate={async (name) => { await onCreateGroup(name); setCreateGroupOpen(false); }}
        />
      )}

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      {selected && (
        <DetailPanel
          app={selected}
          status={statuses[selected.id]}
          onClose={() => setSelectedId(null)}
          onStart={() => onStart(selected.id)}
          onStop={() => onStop(selected.id)}
          onDelete={() => onDelete(selected.id)}
          onEdit={() => setEditingId(selected.id)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
