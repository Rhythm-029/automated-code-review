import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Server,
} from 'lucide-react';
import type { ModelStatus } from '../types/api';
import { fetchModelStatus, fetchOllamaHealth, type OllamaHealth } from '../services/api';

export function ModelStatusPage() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.allSettled([fetchModelStatus(), fetchOllamaHealth()])
      .then(([statusRes, healthRes]) => {
        if (statusRes.status === 'fulfilled') {
          setStatus(statusRes.value);
        } else {
          setError(statusRes.reason?.response?.data?.detail ?? statusRes.reason?.message);
        }
        if (healthRes.status === 'fulfilled') {
          setOllamaHealth(healthRes.value);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <span>Loading model diagnostics…</span>
      </div>
    );
  }

  const isDemo = status?.mode === 'demo';

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={24} color="var(--accent-primary)" /> Model Status & Health
        </h2>
        <p className="page-subtitle">
          Real-time inference engine and local Ollama connection diagnostics.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
        <button className="btn-secondary-modern" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh Diagnostics
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Ollama Live Health Banner */}
      {ollamaHealth && (
        <div
          className="panel-card"
          style={{
            marginBottom: '20px',
            borderLeft: ollamaHealth.ollama_reachable
              ? '4px solid var(--success)'
              : '4px solid var(--danger)',
          }}
        >
          <div className="panel-card-header">
            <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--accent-primary)" /> Local Ollama Service Status
            </span>
            {ollamaHealth.ollama_reachable ? (
              <span className="stat-badge-pill badge-online">Online (Connected)</span>
            ) : (
              <span className="stat-badge-pill badge-pending">Offline (Unreachable)</span>
            )}
          </div>
          <div className="panel-card-body" style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
            <div>REST Endpoint: <code>{ollamaHealth.base_url}</code></div>
            <div>
              Primary Model: <strong>{ollamaHealth.target_model}</strong>{' '}
              {ollamaHealth.target_model_installed ? (
                <span style={{ color: 'var(--success)' }}>✓ Installed & Ready</span>
              ) : (
                <span style={{ color: 'var(--danger)' }}>✗ Not Found</span>
              )}
            </div>
            {ollamaHealth.installed_models && ollamaHealth.installed_models.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>Installed Models:</span>
                {ollamaHealth.installed_models.map((m) => (
                  <span key={m} className="badge-cat-tag">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="panel-card-title">Engine Configuration</span>
              {status.checkpoint_loaded ? (
                <CheckCircle2 size={16} color="var(--success)" />
              ) : (
                <XCircle size={16} color={isDemo ? 'var(--warning)' : 'var(--danger)'} />
              )}
            </div>
            <div className="panel-card-body">
              {[
                ['Configured engine', status.configured_engine],
                ['Active engine', status.active_engine],
                ['Mode', status.mode],
                ['Model identifier', status.model_identifier ?? '—'],
                ['Model ready', status.checkpoint_loaded ? 'Yes ✓ (Connected)' : 'No ✗'],
                ['Training status', status.training_status],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-card-header">
              <span className="panel-card-title">Hardware Acceleration & Runtime</span>
            </div>
            <div className="panel-card-body" style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
              <p style={{ marginBottom: '10px' }}>
                Running with Apple Silicon Metal acceleration on M2 architecture. 100% private, local inference without paid cloud API tokens.
              </p>
              <div
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  lineHeight: '1.9',
                  marginBottom: '10px',
                }}
              >
                <div># Local environment configuration</div>
                <div>REVIEW_ENGINE=ollama</div>
                <div>OLLAMA_BASE_URL=http://localhost:11434</div>
                <div>OLLAMA_MODEL=qwen2.5-coder:7b</div>
              </div>
              <p style={{ color: 'var(--text-muted)' }}>Verify from terminal:</p>
              <code style={{ display: 'block', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
                ollama run qwen2.5-coder:7b
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
