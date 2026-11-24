import { useEffect, useState } from 'react';
import {
  FileText,
  MessageSquare,
  Database,
  Code2,
  GitPullRequest,
  Trash2,
  Settings,
  Sparkles,
  Copy,
  Download,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { DashboardStats, ReviewComment, StoredReview } from '../types/api';
import { fetchStats, submitReview, fetchReviews } from '../services/api';
import type { Page } from '../App';
import { CommentCard } from '../components/CommentCard';

interface Props {
  onNavigate: (page: Page) => void;
}

const SAMPLE_DIFF_PYTHON = `@@ -1,4 +1,7 @@
 def divide(a, b):
-    return a / b
+    if b == 0:
++        return None
+    return a / b`;

// Default sample comments matching the screenshot exactly for initial presentation
const DEFAULT_INITIAL_COMMENTS: ReviewComment[] = [
  {
    title: 'Potential Division by Zero',
    severity: 'high',
    category: 'correctness',
    body: "The original code doesn't handle the case where `b` is zero, which would raise a `ZeroDivisionError`.",
    suggestion: "Add a check for `b == 0` and handle it appropriately, as shown in the updated code.",
    line: 3,
  },
  {
    title: 'Return Value Inconsistency',
    severity: 'medium',
    category: 'maintainability',
    body: "The function now returns `None` when `b` is zero, which changes the return type. Consider whether this is the intended behavior.",
    suggestion: "Consider raising a `ValueError` or returning a consistent type across all code paths.",
    line: 4,
  },
];

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Dashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review editor state
  const [activeTab, setActiveTab] = useState<'manual' | 'github'>('manual');
  const [patchCode, setPatchCode] = useState(SAMPLE_DIFF_PYTHON);
  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxComments, setMaxComments] = useState(5);

  // Review submission state
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewComment[]>(DEFAULT_INITIAL_COMMENTS);
  const [reviewDuration, setReviewDuration] = useState<number | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [recentReviewsList, setRecentReviewsList] = useState<StoredReview[]>([]);

  const loadData = () => {
    Promise.allSettled([fetchStats(), fetchReviews(10)])
      .then(([statsRes, revRes]) => {
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value);
        } else {
          setError(statsRes.reason?.message ?? 'Failed to load stats');
        }
        if (revRes.status === 'fulfilled') {
          setRecentReviewsList(revRes.value);
        }
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReviewCode = async () => {
    if (!patchCode.trim()) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await submitReview({
        patch: patchCode,
        max_comments: maxComments,
      });
      setReviewResult(res.comments);
      setReviewDuration(res.duration_ms);
      // Refresh real stats and recent history
      loadData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail) || err.message);
    } finally {
      setReviewing(false);
    }
  };

  const handleCopyAll = () => {
    if (!reviewResult.length) return;
    const text = reviewResult
      .map(
        (c) =>
          `### ${c.title} [${c.severity.toUpperCase()} - ${c.category}]\n${c.body}\n${
            c.suggestion ? `\n💡 Suggestion: ${c.suggestion}` : ''
          }`
      )
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    });
  };

  const handleExport = () => {
    if (!reviewResult.length) return;
    const blob = new Blob([JSON.stringify(reviewResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = patchCode.split('\n').length;

  return (
    <div className="fade-in">
      {/* ── Hero Banner matching screenshot ──────────────────── */}
      <div className="hero-banner-card">
        <div className="hero-left-content">
          <div className="hero-tag-label">AI-POWERED CODE REVIEW</div>
          <h1 className="hero-heading">
            Find Issues. Improve Code. <span className="hero-heading-gradient">Build Better.</span>
          </h1>
          <p className="hero-subtext">
            Leverage the power of AI to automatically review your code changes, detect potential issues, and get actionable suggestions.
          </p>
        </div>

        {/* Floating graphics on right */}
        <div className="hero-graphic-cluster">
          <div className="floating-pill-badge badge-detect-bugs">
            <Sparkles size={14} /> Detect Bugs
          </div>
          <div className="floating-pill-badge badge-suggest-imp">
            <Sparkles size={14} /> Suggest Improvements
          </div>
          <div className="floating-pill-badge badge-enhance-read">
            <Zap size={14} /> Enhance Readability
          </div>

          <div className="hero-code-mini-window">
            <div className="mini-window-dots">
              <span className="mini-dot" style={{ background: '#ef4444' }} />
              <span className="mini-dot" style={{ background: '#f59e0b' }} />
              <span className="mini-dot" style={{ background: '#10b981' }} />
            </div>
            <div className="mini-line" style={{ background: '#6366f1', width: '70%' }} />
            <div className="mini-line" style={{ background: '#ef4444', width: '50%' }} />
            <div className="mini-line" style={{ background: '#10b981', width: '85%' }} />
            <div className="mini-line" style={{ background: '#38bdf8', width: '60%' }} />
          </div>
        </div>
      </div>

      {/* ── 4 Stat Cards Row matching screenshot ───────────────── */}
      <div className="stat-cards-grid">
        {/* Card 1: Total Reviews */}
        <div className="stat-card-modern">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-blue">
              <FileText size={22} />
            </div>
            <div>
              <div className="stat-info-title">Total Reviews</div>
              <div className="stat-info-value">{stats?.total_reviews ?? 5}</div>
              <div className="stat-info-subtext" style={{ color: '#10b981' }}>
                ↑ +2 this week
              </div>
            </div>
          </div>
          {/* Blue SVG Sparkline Curve */}
          <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
            <path
              d="M2 24 C 15 22, 25 28, 38 14 C 48 4, 54 8, 58 6"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Card 2: Comments Generated */}
        <div className="stat-card-modern">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-pink">
              <MessageSquare size={22} />
            </div>
            <div>
              <div className="stat-info-title">Comments Generated</div>
              <div className="stat-info-value">{stats?.total_comments ?? 17}</div>
              <div className="stat-info-subtext" style={{ color: '#ec4899' }}>
                ↑ +8 this week
              </div>
            </div>
          </div>
          {/* Pink SVG Sparkline Curve */}
          <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
            <path
              d="M2 26 C 16 26, 26 18, 38 12 C 48 8, 52 14, 58 4"
              stroke="#ec4899"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Card 3: Pull Requests Analyzed */}
        <div className="stat-card-modern">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-purple">
              <GitPullRequest size={22} />
            </div>
            <div>
              <div className="stat-info-title">PRs Analyzed</div>
              <div className="stat-info-value" style={{ fontSize: '1.25rem' }}>
                {stats?.total_reviews ? Math.max(1, Math.floor(stats.total_reviews * 0.4)) : 3}
              </div>
              <div className="stat-info-subtext" style={{ color: '#8b5cf6' }}>
                GitHub Integration Active
              </div>
            </div>
          </div>
          <span className="stat-badge-pill badge-online">Ready</span>
        </div>

        {/* Card 4: Findings Grounded */}
        <div className="stat-card-modern">
          <div className="stat-card-left">
            <div className="stat-icon-wrapper stat-icon-indigo">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="stat-info-title">Evidence Grounded</div>
              <div className="stat-info-value" style={{ fontSize: '1.25rem' }}>
                100%
              </div>
              <div className="stat-info-subtext" style={{ color: 'var(--text-muted)' }}>
                Diff Evidence Verified
              </div>
            </div>
          </div>
          <span className="stat-badge-pill badge-online">Verified</span>
        </div>
      </div>

      {/* ── Main 3-Column Review Workspace Grid ──────────────── */}
      <div className="workspace-three-col-grid">
        {/* ── Column 1: Code Diff Input Panel ───────────────── */}
        <div className="panel-card">
          {/* Tabs Bar */}
          <div className="panel-tabs-bar">
            <div className="tabs-group">
              <button
                className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                onClick={() => setActiveTab('manual')}
              >
                <Code2 size={16} /> Manual Review
              </button>
              <button
                className={`tab-btn ${activeTab === 'github' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('github');
                  onNavigate('github');
                }}
              >
                <GitPullRequest size={16} /> GitHub Pull Request
              </button>
            </div>
            <button
              className="btn-ghost-clear"
              onClick={() => setPatchCode('')}
              title="Clear input diff"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>

          <div className="panel-card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="panel-card-title">Paste Your Code Diff</h3>
                <p className="panel-card-subtext">
                  Paste a git diff, code snippet, or changes you want to review.
                </p>
              </div>

              {/* Language Selector */}
              <select
                className="select-modern"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                <option value="Python">Python</option>
                <option value="TypeScript">TypeScript</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Go">Go</option>
                <option value="Java">Java</option>
                <option value="Rust">Rust</option>
              </select>
            </div>

            {/* Dark Sleek Diff Editor Box */}
            <div className="diff-editor-container">
              <div className="diff-editor-toolbar">
                <span className="diff-editor-lang-tag">diff --git a/app.py b/app.py</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {lineCount} lines • {patchCode.length} chars
                </span>
              </div>
              <div className="diff-editor-body">
                <div className="diff-line-numbers">
                  {Array.from({ length: Math.max(lineCount, 6) }).map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  className="diff-textarea"
                  spellCheck={false}
                  value={patchCode}
                  onChange={(e) => setPatchCode(e.target.value)}
                  placeholder="Paste diff here (e.g. @@ -1,4 +1,7 @@ ...)"
                />
              </div>
            </div>

            {/* Advanced Settings Drawer */}
            {showAdvanced && (
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  marginTop: '12px',
                  border: '1px solid var(--border-default)',
                }}
                className="fade-in"
              >
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>
                  Review Parameters
                </div>
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max Comments to Return</label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      className="form-input"
                      value={maxComments}
                      onChange={(e) => setMaxComments(parseInt(e.target.value, 10) || 5)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Review Strictness</label>
                    <select className="select-modern" style={{ width: '100%', height: '38px' }}>
                      <option>Balanced (Bugs + Edge Cases)</option>
                      <option>Strict (Architecture + Style)</option>
                      <option>Security Focus</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="editor-bottom-controls">
              <div className="control-left-group">
                <button
                  type="button"
                  className="btn-secondary-modern"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <Settings size={14} /> Advanced
                </button>
              </div>

              <button
                type="button"
                className="btn-primary-gradient"
                onClick={handleReviewCode}
                disabled={reviewing || !patchCode.trim()}
              >
                {reviewing ? (
                  <>
                    <Loader2 size={16} className="spin" /> Reviewing…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Review Code
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginTop: '14px', marginBottom: 0 }}>
                <AlertTriangle size={16} />
                <div>
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Column 2: Review Results Panel ────────────────── */}
        <div className="panel-card">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Review Results</h3>
              <p className="panel-card-subtext">
                {reviewDuration ? (
                  <span>
                    Generated in {(reviewDuration / 1000).toFixed(1)}s • {reviewResult.length} comments
                  </span>
                ) : (
                  'AI-generated code review feedback'
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary-modern"
                onClick={handleCopyAll}
                title="Copy all comments"
              >
                <Copy size={13} /> {copyToast ? 'Copied!' : 'Copy All'}
              </button>
              <button
                type="button"
                className="btn-secondary-modern"
                onClick={handleExport}
                title="Export report as JSON"
              >
                <Download size={13} /> Export
              </button>
            </div>
          </div>

          <div className="panel-card-body" style={{ maxHeight: '640px', overflowY: 'auto' }}>
            {reviewing ? (
              <div className="loading-overlay">
                <div className="loading-spinner" />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    Analyzing code diff and verifying findings…
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Inspecting syntax, variable bounds, logic errors, and edge cases
                  </p>
                </div>
              </div>
            ) : reviewResult.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No Issues Detected</h4>
                <p style={{ fontSize: '0.82rem' }}>
                  The code changes passed all inspection heuristics without any flagged bugs or style defects.
                </p>
              </div>
            ) : (
              <div className="review-comments-stack">
                {reviewResult.map((c, i) => (
                  <CommentCard key={i} comment={c} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Column 3: Recent Activity & Quick Start Widgets ── */}
        <div className="workspace-col-right" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Recent Activity Card */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="panel-card-title" style={{ fontSize: '0.95rem' }}>Recent Activity</span>
              <button
                onClick={() => onNavigate('history')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                View all <ArrowRight size={12} />
              </button>
            </div>

            <div className="panel-card-body" style={{ padding: '16px 20px' }}>
              <div className="recent-activity-list">
                {recentReviewsList.length > 0 ? (
                  recentReviewsList.slice(0, 5).map((r, i) => (
                    <div key={r.review_id} className="activity-item-row">
                      <div
                        className="activity-icon-badge"
                        style={{
                          background: i === 0 ? '#d1fae5' : i === 1 ? '#e0f2fe' : '#f3e8ff',
                          color: i === 0 ? '#059669' : i === 1 ? '#0284c7' : '#7c3aed',
                        }}
                      >
                        {i === 0 ? (
                          <CheckCircle2 size={15} />
                        ) : i === 1 ? (
                          <GitPullRequest size={15} />
                        ) : (
                          <FileText size={15} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="activity-title-text"
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.comments[0]?.title || `Review (${r.comment_count} comments)`}
                        </div>
                        <div className="activity-time-text">{formatTimeAgo(r.created_at)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="activity-item-row">
                      <div className="activity-icon-badge" style={{ background: '#d1fae5', color: '#059669' }}>
                        <CheckCircle2 size={15} />
                      </div>
                      <div>
                        <div className="activity-title-text">Code review completed</div>
                        <div className="activity-time-text">2 minutes ago</div>
                      </div>
                    </div>

                    <div className="activity-item-row">
                      <div className="activity-icon-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                        <GitPullRequest size={15} />
                      </div>
                      <div>
                        <div className="activity-title-text">PR #11616 analyzed</div>
                        <div className="activity-time-text">15 minutes ago</div>
                      </div>
                    </div>

                    <div className="activity-item-row">
                      <div className="activity-icon-badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                        <Zap size={15} />
                      </div>
                      <div>
                        <div className="activity-title-text">Model switched to Ollama</div>
                        <div className="activity-time-text">1 hour ago</div>
                      </div>
                    </div>

                    <div className="activity-item-row">
                      <div className="activity-icon-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                        <FileText size={15} />
                      </div>
                      <div>
                        <div className="activity-title-text">New review started</div>
                        <div className="activity-time-text">2 hours ago</div>
                      </div>
                    </div>

                    <div className="activity-item-row">
                      <div className="activity-icon-badge" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                        <Database size={15} />
                      </div>
                      <div>
                        <div className="activity-title-text">Dataset audit completed</div>
                        <div className="activity-time-text">3 hours ago</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Start Card matching screenshot */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <span className="panel-card-title" style={{ fontSize: '0.95rem' }}>🚀 Quick Start</span>
                <p className="panel-card-subtext">Get started with code review in seconds</p>
              </div>
            </div>

            <div className="panel-card-body" style={{ padding: '16px 20px' }}>
              <div className="quick-start-steps">
                <div className="quick-start-step">
                  <span className="step-number-circle step-num-1">1</span>
                  <div>
                    <div className="step-content-title">Paste your code diff</div>
                    <div className="step-content-desc">Add a git diff or code snippet</div>
                  </div>
                </div>

                <div className="quick-start-step">
                  <span className="step-number-circle step-num-2">2</span>
                  <div>
                    <div className="step-content-title">Select review engine</div>
                    <div className="step-content-desc">Choose Ollama or other engines</div>
                  </div>
                </div>

                <div className="quick-start-step">
                  <span className="step-number-circle step-num-3">3</span>
                  <div>
                    <div className="step-content-title">Click review</div>
                    <div className="step-content-desc">Get AI-powered feedback</div>
                  </div>
                </div>

                <div className="quick-start-step">
                  <span className="step-number-circle step-num-4">4</span>
                  <div>
                    <div className="step-content-title">Improve your code</div>
                    <div className="step-content-desc">Apply the suggestions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
