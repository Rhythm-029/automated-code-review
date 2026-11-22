import { useEffect, useState } from 'react';
import {
  History,
  Trash2,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Search,
  Code2,
} from 'lucide-react';
import type { StoredReview } from '../types/api';
import { fetchReviews, deleteReview } from '../services/api';
import { CommentCard } from '../components/CommentCard';
import type { Page } from '../App';

interface Props {
  onNavigate: (page: Page) => void;
}

export function ReviewHistory({ onNavigate }: Props) {
  const [reviews, setReviews] = useState<StoredReview[]>([]);
  const [selected, setSelected] = useState<StoredReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = () => {
    setLoading(true);
    fetchReviews(100)
      .then(setReviews)
      .catch((err) => setError(err?.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteReview(id);
      if (selected?.review_id === id) setSelected(null);
      setReviews((prev) => prev.filter((r) => r.review_id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err.message);
    } finally {
      setDeleting(null);
    }
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  };

  const filtered = reviews.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.review_id.toLowerCase().includes(q) ||
      r.engine.toLowerCase().includes(q) ||
      r.patch_preview.toLowerCase().includes(q) ||
      r.comments.some((c) => c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={24} color="var(--accent-primary)" /> Review History
        </h2>
        <p className="page-subtitle">
          Audit trail of past automated code reviews, comments generated, and engine metrics.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div className="header-search-container" style={{ width: '320px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="header-search-input"
            placeholder="Filter past reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary-modern" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn-primary-gradient" onClick={() => onNavigate('dashboard')}>
            <Code2 size={14} /> New Review
          </button>
        </div>
      </div>

      {/* Layout: Review List + Detail Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.1fr 1.2fr' : '1fr', gap: '20px' }}>
        {/* Reviews List */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title">Stored Reviews ({filtered.length})</span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Saved to <code>backend/reviews.json</code>
            </span>
          </div>

          <div className="panel-card-body" style={{ padding: '8px' }}>
            {loading ? (
              <div className="loading-overlay">
                <div className="loading-spinner" />
                <span>Loading review history…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <History size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No reviews found</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Run a review on the Dashboard to see it listed here.
                </div>
              </div>
            ) : (
              filtered.map((r) => {
                const isSel = selected?.review_id === r.review_id;
                return (
                  <div
                    key={r.review_id}
                    onClick={() => setSelected(r)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      border: isSel ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      background: isSel ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                      transition: 'var(--transition)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge-cat-tag">{r.engine}</span>
                        <span className="badge-sev-info">{r.comment_count} comments</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {fmt(r.created_at)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.patch_preview}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                      <button
                        title="Delete review"
                        disabled={deleting === r.review_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(r.review_id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: deleting === r.review_id ? 'var(--text-muted)' : 'var(--danger)',
                          cursor: deleting === r.review_id ? 'not-allowed' : 'pointer',
                          padding: '6px',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Review Details Panel */}
        {selected && (
          <div className="panel-card fade-in">
            <div className="panel-card-header">
              <div>
                <span className="panel-card-title">Review Details</span>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  ID: {selected.review_id} • {selected.duration_ms}ms
                </div>
              </div>
              <button
                className="btn-secondary-modern"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>

            <div className="panel-card-body" style={{ maxHeight: '680px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '16px' }}>
                <div className="form-label">Patch Code Reviewed:</div>
                <pre
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    overflowX: 'auto',
                  }}
                >
                  {selected.patch_preview}
                </pre>
              </div>

              <div className="form-label" style={{ marginBottom: '10px' }}>
                Generated Comments ({selected.comments.length}):
              </div>

              <div className="review-comments-stack">
                {selected.comments.map((c, i) => (
                  <CommentCard key={i} comment={c} index={i} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
