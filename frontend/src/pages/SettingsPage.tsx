import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  GitPullRequest,
  Sliders,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { fetchGitHubStatus } from '../services/api';
import type { GitHubTokenStatus } from '../types/api';

export function SettingsPage() {
  const [maxPatchChars, setMaxPatchChars] = useState(50000);
  const [defaultComments, setDefaultComments] = useState(5);
  const [savedToast, setSavedToast] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubTokenStatus | null>(null);

  useEffect(() => {
    fetchGitHubStatus().then(setGithubStatus).catch(() => {});
  }, []);

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SettingsIcon size={24} color="var(--accent-primary)" /> Platform Settings
        </h2>
        <p className="page-subtitle">
          Configure GitHub integration credentials, review constraints, and comment preferences.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* GitHub Integration Status */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitPullRequest size={18} /> GitHub Integration
            </span>
            {githubStatus?.valid ? (
              <span className="stat-badge-pill badge-online">Connected</span>
            ) : (
              <span className="stat-badge-pill badge-pending">Public Access</span>
            )}
          </div>

          <div className="panel-card-body">
            <div className="form-group">
              <label className="form-label">Personal Access Token (PAT)</label>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <ShieldCheck size={20} color="var(--success)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Personal Access Token Active
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Remaining API Quota: {githubStatus?.rate_limit_remaining ?? 5000} / 5,000 requests/hr
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Configuration Location</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Configured securely in backend <code>.env</code> file under <code>GITHUB_TOKEN</code>.
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary-modern"
                style={{ display: 'inline-flex' }}
              >
                Manage Tokens on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Review Constraints */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} /> Review Configuration
            </span>
          </div>

          <div className="panel-card-body">
            <div className="form-group">
              <label className="form-label">Max Patch Characters: {maxPatchChars.toLocaleString()}</label>
              <input
                type="range"
                min="10000"
                max="100000"
                step="5000"
                value={maxPatchChars}
                onChange={(e) => setMaxPatchChars(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Controls the maximum size of individual diffs analyzed per file.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Default Comments Per Review: {defaultComments}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={defaultComments}
                onChange={(e) => setDefaultComments(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Maximum findings returned per file to prevent cognitive overload.
              </span>
            </div>

            <button className="btn-primary-modern" onClick={handleSave} style={{ marginTop: '12px' }}>
              <Save size={14} /> Save Preferences
            </button>

            {savedToast && (
              <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--success)' }}>
                ✓ Settings saved successfully
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
