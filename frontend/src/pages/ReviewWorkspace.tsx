import { useState, useEffect } from 'react';
import {
  Trash2,
  Sparkles,
  CopyCheck,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileCode2,
} from 'lucide-react';
import type { ReviewResponse } from '../types/api';
import { submitReview } from '../services/api';
import { CommentCard } from '../components/CommentCard';

const SAMPLE_DIFF_1 = `@@ -1,4 +1,7 @@
 def divide(a, b):
-    return a / b
+    if b == 0:
+        return None
+    return a / b`;

const SAMPLE_DIFF_2 = `@@ -10,12 +10,14 @@
 def processUserData(d):
-    name = d["name"]
-    email = d["email"]
+    name = d.get("name", "Unknown")
+    email = d.get("email")
+    if not email:
+        raise ValueError("Email is required")
     db.save(name, email)
-    print("saved: " + name + " " + email)
+    logger.info("saved user: %s", name)`;

export function ReviewWorkspace() {
  const [patch, setPatch] = useState('');
  const [oldf, setOldf] = useState('');
  const [showOldf, setShowOldf] = useState(false);
  const [maxComments, setMaxComments] = useState(5);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Timer while loading local model inference
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (loading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const handleSubmit = async () => {
    if (!patch.trim()) {
      setError('Please paste a code diff before submitting.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await submitReview({
        patch,
        oldf: oldf || undefined,
        max_comments: maxComments,
      });
      setResult(res);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = errorObj?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail) ?? errorObj.message ?? 'Review failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (!result) return;
    const text = result.comments
      .map(
        (c, i) =>
          `${i + 1}. [${c.severity.toUpperCase()}] ${c.title}\n${c.body}${
            c.suggestion ? `\n💡 ${c.suggestion}` : ''
          }`
      )
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const handleClear = () => {
    setPatch('');
    setOldf('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCode2 size={24} color="var(--accent-primary)" /> Code Review Workspace
        </h2>
        <p className="page-subtitle">
          Dedicated full-page code reviewer. Paste your diff and original file context to run comprehensive inspection.
        </p>
      </div>

      {/* Input panel */}
      <div className="panel-card" style={{ marginBottom: '24px' }}>
        <div className="panel-card-header">
          <span className="panel-card-title">Code Diff Input</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-secondary-modern" onClick={() => setPatch(SAMPLE_DIFF_1)}>
              Sample 1 (Division guard)
            </button>
            <button className="btn-secondary-modern" onClick={() => setPatch(SAMPLE_DIFF_2)}>
              Sample 2 (Dict access & logging)
            </button>
          </div>
        </div>

        <div className="panel-card-body">
          <div className="form-group">
            <label className="form-label">Git Diff / Patch *</label>
            <textarea
              className="diff-textarea"
              style={{
                width: '100%',
                background: '#0f172a',
                color: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                border: '1px solid #334155',
                minHeight: '220px',
              }}
              placeholder={`Paste your git diff here, e.g.:\n\n@@ -1,4 +1,7 @@\n def divide(a, b):\n+    if b == 0:\n+        return None\n     return a / b`}
              value={patch}
              onChange={(e) => setPatch(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {patch.length.toLocaleString()} / 50,000 chars
              </span>
              {patch.length > 50000 && (
                <span style={{ fontSize: '0.74rem', color: 'var(--danger)' }}>
                  ⚠ Exceeds maximum size
                </span>
              )}
            </div>
          </div>

          {/* Optional old file context */}
          <div className="form-group">
            <button
              type="button"
              className="btn-secondary-modern"
              onClick={() => setShowOldf(!showOldf)}
              style={{ marginBottom: '8px' }}
            >
              {showOldf ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showOldf ? 'Hide' : 'Add'} original file context (optional)
            </button>
            {showOldf && (
              <textarea
                className="diff-textarea"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  border: '1px solid #334155',
                  minHeight: '140px',
                }}
                placeholder="Paste the original source file here for additional context…"
                value={oldf}
                onChange={(e) => setOldf(e.target.value)}
              />
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Max comments:</label>
                <select
                  className="select-modern"
                  value={maxComments}
                  onChange={(e) => setMaxComments(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary-modern" onClick={handleClear} disabled={loading}>
                <Trash2 size={14} /> Clear
              </button>
              <button
                id="analyze-btn"
                className="btn-primary-gradient"
                onClick={handleSubmit}
                disabled={loading || !patch.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" /> Reviewing ({elapsedSeconds}s)…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Review Code
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '16px', marginBottom: 0 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Error executing review:</strong> {error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading state with progress feedback */}
      {loading && (
        <div className="panel-card" style={{ padding: '36px', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
            Analyzing code diff and verifying findings…
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Elapsed: <strong>{elapsedSeconds}s</strong> · Scanning diff for potential bugs, logic flaws, and edge cases.
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="fade-in">
          {/* Summary bar */}
          <div
            className="panel-card"
            style={{
              padding: '14px 20px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Review Completed</span>
              </div>
              <span className="badge-cat-tag">Engine: {result.engine}</span>
              <span className="badge-cat-tag">Comments: {result.comments.length}</span>
              <span className="badge-cat-tag">Duration: {(result.duration_ms / 1000).toFixed(1)}s</span>
            </div>

            <button className="btn-secondary-modern" onClick={handleCopyAll}>
              {copiedAll ? <><CopyCheck size={13} color="var(--success)" /> Copied!</> : <><ClipboardList size={13} /> Copy All</>}
            </button>
          </div>

          {result.comments.length === 0 ? (
            <div className="panel-card" style={{ padding: '40px', textAlign: 'center' }}>
              <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontWeight: 700 }}>No issues found</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                The model did not generate any review comments for this diff.
              </p>
            </div>
          ) : (
            <div className="review-comments-stack">
              {result.comments.map((c, i) => (
                <CommentCard key={i} comment={c} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
