import { useCallback, useEffect, useState } from 'react';
import type { AppConfig, AppStatusInfo } from './global';
import Header from './components/Header';
import GridView from './components/GridView';
import ListView from './components/ListView';
import AddAppDialog from './components/AddAppDialog';
import DetailPanel from './components/DetailPanel';

export type ViewMode = 'grid' | 'list';

export default function App(): JSX.Element {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AppStatusInfo>>({});
  const [view, setView] = useState<ViewMode>(
    (localStorage.getItem('view') as ViewMode) || 'grid'
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await window.api.list();
    setApps(res.apps);
    setStatuses(res.statuses);
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
  const onDelete = async (id: string) => {
    const isRunning = statuses[id]?.status === 'running';
    const msg = isRunning
      ? 'This app is running. Stop it and delete?'
      : 'Delete this app?';
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

  return (
    <div className="app">
      <Header
        view={view}
        onViewChange={setView}
        onAdd={() => setAddOpen(true)}
      />
      <main className="content">
        {apps.length === 0 ? (
          <div className="empty">
            <p>No apps yet.</p>
            <button onClick={() => setAddOpen(true)}>+ Add your first app</button>
          </div>
        ) : view === 'grid' ? (
          <GridView apps={apps} statuses={statuses} onOpen={setSelectedId} />
        ) : (
          <ListView
            apps={apps}
            statuses={statuses}
            onOpen={setSelectedId}
            onStart={onStart}
            onStop={onStop}
          />
        )}
      </main>

      {(addOpen || editingId) && (
        <AddAppDialog
          editing={editingId ? apps.find(a => a.id === editingId) ?? null : null}
          existingPorts={apps.map(a => ({ id: a.id, port: a.port }))}
          onClose={() => { setAddOpen(false); setEditingId(null); }}
          onSaved={async () => { setAddOpen(false); setEditingId(null); await reload(); }}
          showError={showError}
        />
      )}

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
