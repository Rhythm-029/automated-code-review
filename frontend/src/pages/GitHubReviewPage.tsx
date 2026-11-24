import { useState, useEffect } from 'react';
import {
  GitPullRequest,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  FileCheck,
  FileX2,
} from 'lucide-react';
import type { GitHubReviewResponse, GitHubTokenStatus } from '../types/api';
import { reviewGitHubPR, fetchGitHubStatus } from '../services/api';
import { CommentCard } from '../components/CommentCard';

export function GitHubReviewPage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [fileLimitSelection, setFileLimitSelection] = useState<string>('3');
  const [tokenStatus, setTokenStatus] = useState<GitHubTokenStatus | null>(null);
  const [tokenLoading, setTokenLoading] = useState<boolean>(true);

  const [result, setResult] = useState<GitHubReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    fetchGitHubStatus()
      .then((st) => {
        if (mounted) setTokenStatus(st);
      })
      .catch((err) => {
        if (mounted) {
          setTokenStatus({
            configured: false,
            valid: false,
            error: err.message,
          });
        }
      })
      .finally(() => {
        if (mounted) setTokenLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (loading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const setSamplePR = (repo: string, num: number) => {
    setPrUrl(`https://github.com/${repo}/pull/${num}`);
    setRepoUrl(repo);
    setPrNumber(String(num));
    setError(null);
  };

  const isAllFiles = fileLimitSelection === 'all';
  const numericMaxFiles = isAllFiles ? 100 : parseInt(fileLimitSelection, 10);

  const handleSubmit = async () => {
    if (!prUrl.trim() && (!repoUrl.trim() || !prNumber.trim())) {
      setError('Please enter either a full GitHub PR URL, or both repository URL and pull request number.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const num = prNumber.trim() ? parseInt(prNumber, 10) : undefined;
      const res = await reviewGitHubPR({
        pr_url: prUrl.trim() || undefined,
        repo_url: repoUrl.trim() || undefined,
        pr_number: num,
        max_comments: 5,
        max_files: numericMaxFiles,
        review_all_files: isAllFiles,
      });
      setResult(res);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const detailMsg = typeof detail === 'string' ? detail : (detail?.message || JSON.stringify(detail) || err.message);

      if (status === 401) {
        setError(`Authentication Failed (401): ${detailMsg}. Please check GITHUB_TOKEN in .env.`);
      } else if (status === 403) {
        setError(`Forbidden or Rate Limited (403): ${detailMsg}. Token may lack read permissions or quota is exhausted.`);
      } else if (status === 404) {
        setError(`Not Found (404): ${detailMsg}. Verify the repository name and pull request number exist.`);
      } else if (status === 502) {
        setError(`LLM Engine / Upstream Error (502): ${detailMsg}`);
      } else {
        setError(detailMsg || 'An unexpected error occurred while reviewing the pull request.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitPullRequest size={24} color="var(--accent-primary)" /> GitHub Pull Request Review
        </h2>
        <p className="page-subtitle">
          Securely fetch public or private pull requests with pagination support, inspect diff hunks, and generate actionable code review feedback.
          This feature is strictly read-only and never posts review comments to GitHub without approval.
        </p>
      </div>

      {/* GitHub Token Status Card */}
      <div className="panel-card" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {tokenLoading ? (
              <Loader2 size={20} className="spin" style={{ color: 'var(--text-muted)' }} />
            ) : tokenStatus?.valid ? (
              <ShieldCheck size={24} color="var(--success)" />
            ) : (
              <ShieldAlert size={24} color="var(--warning)" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                GitHub Integration Authentication
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {tokenLoading && 'Checking token configuration...'}
                {!tokenLoading && tokenStatus?.valid && (
                  <span>
                    Authenticated as <strong>@{tokenStatus.username}</strong> • Personal Access Token active
                  </span>
                )}
                {!tokenLoading && !tokenStatus?.valid && tokenStatus?.configured && (
                  <span style={{ color: 'var(--danger)' }}>
                    Invalid token configured: {tokenStatus.error || 'Unauthorized'}
                  </span>
                )}
                {!tokenLoading && !tokenStatus?.configured && (
                  <span>Unauthenticated mode (rate limit: 60 req/hr). Add GITHUB_TOKEN to .env for 5,000 req/hr.</span>
                )}
              </div>
            </div>
          </div>

          {!tokenLoading && tokenStatus?.valid && tokenStatus.rate_limit_remaining !== null && (
            <div>
              <span className="stat-badge-pill badge-online" style={{ fontSize: '0.78rem' }}>
                API Quota: {tokenStatus.rate_limit_remaining} / {tokenStatus.rate_limit_limit} reqs
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Request Form */}
      <div className="panel-card" style={{ marginBottom: '24px' }}>
        <div className="panel-card-header">
          <span className="panel-card-title">Pull Request Parameters</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Presets:</span>
            <button
              type="button"
              className="btn-secondary-modern"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setSamplePR('tensorflow/tensorflow', 62000)}
            >
              tensorflow #62000
            </button>
            <button
              type="button"
              className="btn-secondary-modern"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setSamplePR('octocat/Hello-World', 11616)}
            >
              octocat #11616
            </button>
            <button
              type="button"
              className="btn-secondary-modern"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setSamplePR('facebook/react', 32000)}
            >
              react #32000
            </button>
          </div>
        </div>

        <div className="panel-card-body">
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Full Pull Request URL (or specify repo & PR # below)</label>
            <input
              type="text"
              className="input-text-modern"
              value={prUrl}
              onChange={(e) => {
                setPrUrl(e.target.value);
                const m = e.target.value.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
                if (m) {
                  setRepoUrl(`${m[1]}/${m[2]}`);
                  setPrNumber(m[3]);
                }
              }}
              placeholder="https://github.com/owner/repository/pull/123"
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Repository URL or owner/repo</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. owner/repo or https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pull Request Number</label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 11616"
                min={1}
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '10px', marginBottom: '16px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Review Scope & File Limit</label>
              <select
                className="form-input"
                value={fileLimitSelection}
                onChange={(e) => setFileLimitSelection(e.target.value)}
              >
                <option value="1">1 changed file (Fastest)</option>
                <option value="2">2 changed files (Quick)</option>
                <option value="3">3 changed files (Default)</option>
                <option value="5">Up to 5 changed files</option>
                <option value="10">Up to 10 changed files</option>
                <option value="all">⚡ Review ALL supported files (Full PR review)</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Files with clean diffs produce zero artificial comments.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary-gradient"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" /> Fetching & Reviewing ({elapsedSeconds}s)…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Fetch & Review PR
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '16px', marginBottom: 0 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Request Failed:</strong>
                <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>{error}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="panel-card" style={{ padding: '36px', textAlign: 'center', marginBottom: '24px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
            Analyzing Pull Request changes and diff hunks…
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Fetching changed files via GitHub API (with pagination), inspecting diff hunks, and generating review comments ({elapsedSeconds}s)
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="fade-in">
          {/* PR Header & External Link */}
          <div className="panel-card" style={{ marginBottom: '20px' }}>
            <div className="panel-card-header">
              <span className="panel-card-title">
                Pull Request #{result.pr_info.number}: {result.pr_info.title}
              </span>
              <a
                href={result.pr_info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary-modern"
              >
                <ExternalLink size={13} /> View on GitHub
              </a>
            </div>

            <div className="panel-card-body">
              {/* 4 Key Audit Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div className="stat-card-modern" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <Layers size={14} /> Total Files in PR
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
                    {result.total_files_changed ?? result.pr_info.total_changed_files ?? result.pr_info.files.length}
                  </div>
                </div>

                <div className="stat-card-modern" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <FileText size={14} /> Files Fetched
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent-primary)' }}>
                    {result.total_files_fetched ?? result.pr_info.files.length}
                  </div>
                </div>

                <div className="stat-card-modern" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <FileCheck size={14} /> Files Reviewed
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>
                    {result.total_files_reviewed ?? result.file_reviews.length}
                  </div>
                </div>

                <div className="stat-card-modern" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <FileX2 size={14} /> Files Skipped
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (result.skipped_files?.length ?? 0) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                    {result.skipped_files?.length ?? 0}
                  </div>
                </div>
              </div>

              {/* PR metadata grid */}
              <div className="grid-2">
                {[
                  ['Author', `@${result.pr_info.author}`],
                  ['State', result.pr_info.state.toUpperCase()],
                  ['Branches', `${result.pr_info.head_branch} → ${result.pr_info.base_branch}`],
                  ['Review Pipeline', 'Automated Verification'],
                ].map(([k, v]) => (
                  <div
                    key={String(k)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Skipped files section */}
          {result.skipped_files && result.skipped_files.length > 0 && (
            <div className="panel-card" style={{ marginBottom: '20px' }}>
              <div
                className="panel-card-header"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setShowSkipped(!showSkipped)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={16} color="#f59e0b" />
                  <span className="panel-card-title">
                    Skipped Files & Reasons ({result.skipped_files.length})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{showSkipped ? 'Collapse' : 'Expand'}</span>
                  {showSkipped ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {showSkipped && (
                <div className="panel-card-body" style={{ paddingTop: 0 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Files are skipped when configured limits are reached, when patches are omitted (e.g. binaries, deleted files), or when diffs exceed GitHub size limits.
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px 12px' }}>File</th>
                          <th style={{ padding: '8px 12px' }}>Git Status</th>
                          <th style={{ padding: '8px 12px' }}>Reason Skipped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.skipped_files.map((sf, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                              {sf.filename}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className="badge-cat-tag" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                                {sf.status}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                              {sf.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File reviews */}
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              Reviewed Files ({result.file_reviews.length})
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Model: <code>qwen2.5-coder:7b</code> (Strict non-speculative mode)
            </span>
          </div>

          {result.file_reviews.length === 0 ? (
            <div className="panel-card" style={{ padding: '40px', textAlign: 'center' }}>
              <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontWeight: 700 }}>No reviewable diff hunks</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                All changed files were either binary, deleted, or omitted by GitHub's diff cutoff.
              </p>
            </div>
          ) : (
            result.file_reviews.map((fr, fi) => {
              const prFile = result.pr_info.files[fi];
              return (
                <div key={fr.review_id || fi} className="panel-card" style={{ marginBottom: '20px' }}>
                  <div className="panel-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge-cat-tag" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {prFile?.filename ?? `File ${fi + 1}`}
                      </span>
                      {prFile && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--success)' }}>+{prFile.additions}</span> /{' '}
                          <span style={{ color: 'var(--danger)' }}>-{prFile.deletions}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={fr.comments.length > 0 ? 'badge-sev-medium' : 'badge-sev-info'}>
                        {fr.comments.length} {fr.comments.length === 1 ? 'finding' : 'findings'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(fr.duration_ms / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </div>

                  <div className="panel-card-body">
                    {fr.comments.length === 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 16px',
                          background: 'rgba(34, 197, 94, 0.08)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                          borderRadius: '6px',
                          color: 'var(--success)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                        <span>
                          <strong>Clean diff:</strong> No actionable bugs, logic errors, or security risks identified in this file patch.
                        </span>
                      </div>
                    ) : (
                      <div className="review-comments-stack">
                        {fr.comments.map((c, ci) => (
                          <CommentCard key={ci} comment={c} index={ci} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
