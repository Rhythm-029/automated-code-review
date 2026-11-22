import { useState } from 'react';
import { Database, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { DatasetAuditReport, DatasetSplitStats } from '../types/api';
import { fetchDatasetAudit } from '../services/api';

function SplitCard({ s }: { s: DatasetSplitStats }) {
  return (
    <div className="panel-card" style={{ marginBottom: '16px' }}>
      <div className="panel-card-header">
        <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {s.exists ? (
            <CheckCircle2 size={16} color="var(--success)" />
          ) : (
            <XCircle size={16} color="var(--danger)" />
          )}
          {s.split.toUpperCase()} Split
        </span>
        <span className="badge-cat-tag">
          {s.exists ? `${(s.record_count ?? 0).toLocaleString()} records` : 'NOT FOUND'}
        </span>
      </div>

      <div className="panel-card-body">
        {!s.exists ? (
          <div className="alert alert-warning" style={{ marginBottom: 0 }}>
            <AlertTriangle size={14} />
            <span>File not found at: <code>{s.path}</code></span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              ['Records', (s.record_count ?? 0).toLocaleString()],
              ['Duplicate IDs', s.duplicate_ids],
              ['Exact dup records', s.exact_duplicate_records],
              ['Dup patch-comment pairs', s.duplicate_patch_comment_pairs],
              ['Missing oldf', s.missing_oldf_count],
              ['Comment len (mean)', s.comment_length_stats?.mean?.toFixed(1) ?? '—'],
              ['Comment len (max)', s.comment_length_stats?.max ?? '—'],
              ['Label distribution', JSON.stringify(s.label_distribution ?? {})],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{String(v ?? '—')}</span>
              </div>
            ))}
            {s.error && (
              <div className="alert alert-error" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                <AlertTriangle size={14} />
                <span>{s.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DatasetStatusPage() {
  const [report, setReport] = useState<DatasetAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = () => {
    setLoading(true);
    setError(null);
    fetchDatasetAudit()
      .then(setReport)
      .catch((err) => setError(err?.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={24} color="var(--accent-primary)" /> Dataset Audit & Health
        </h2>
        <p className="page-subtitle">
          Audit dataset splits (train, validation, test) for missing fields, duplicate patch pairs, and leakage across splits.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button className="btn-primary-gradient" onClick={runAudit} disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="spin" /> Running Audit…
            </>
          ) : (
            <>
              <RefreshCw size={14} /> Run Dataset Audit
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!report && !loading && (
        <div className="panel-card" style={{ padding: '36px', textAlign: 'center' }}>
          <Database size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
          <h4 style={{ fontWeight: 700, marginBottom: '6px' }}>No audit performed yet</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Click &quot;Run Dataset Audit&quot; to inspect your <code>dataset/</code> folder for split statistics and integrity checks.
          </p>
        </div>
      )}

      {report && (
        <div>
          <div style={{ marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Audit Timestamp: {new Date(report.audit_timestamp).toLocaleString()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {report.splits.map((s) => (
              <SplitCard key={s.split} s={s} />
            ))}
          </div>

          {report.notes.length > 0 && (
            <div className="panel-card" style={{ marginTop: '20px' }}>
              <div className="panel-card-header">
                <span className="panel-card-title">Auditor Notes</span>
              </div>
              <div className="panel-card-body">
                {report.notes.map((n, i) => (
                  <div key={i} className="alert alert-info" style={{ marginBottom: '8px' }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
