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
  const [analyzing, setAnalyzing] = useState(false);
  const logsRef = useRef<HTMLPreElement | null>(null);

  const running = status?.status === 'running';
  const dp = app.detectedPorts;
  const hasDetectedPorts = dp && (dp.rest != null || dp.grpc != null || dp.frontend != null);
  const aiAnalysis = status?.aiAnalysis;

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

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await window.api.reanalyze(app.id);
    } finally {
      setAnalyzing(false);
    }
  };

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

        {hasDetectedPorts && (
          <div className="field">
            <label>Detected ports (AI)</label>
            <div className="detected-ports">
              {dp.rest != null && <span className="port-badge">REST <strong>{dp.rest}</strong></span>}
              {dp.grpc != null && <span className="port-badge">gRPC <strong>{dp.grpc}</strong></span>}
              {dp.frontend != null && <span className="port-badge">Frontend <strong>{dp.frontend}</strong></span>}
            </div>
          </div>
        )}

        <div className="field">
          <label>Status</label>
          <span className={running ? 'running' : 'stopped'}>
            {running ? `● Running (pid ${status?.pid})` : '○ Stopped'}
          </span>
        </div>

        {!running && aiAnalysis && (
          <div className="ai-analysis">
            <div className="ai-analysis-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              AI Failure Analysis
            </div>
            <div className="ai-reason"><strong>Reason:</strong> {aiAnalysis.reason}</div>
            <div className="ai-action"><strong>Action:</strong> {aiAnalysis.action}</div>
          </div>
        )}

        <div className="actions">
          {running
            ? <button onClick={onStop}>Stop</button>
            : <button onClick={onStart}>Start</button>}
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete} className="danger">Delete</button>
          <button onClick={handleReanalyze} disabled={analyzing} title="Run AI log analysis now (results appear in logs below)">
            {analyzing ? '⏳ Analyzing…' : '✦ AI Analyze'}
          </button>
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
