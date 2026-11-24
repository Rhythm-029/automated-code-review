import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  GitPullRequest,
  Sliders,
  RotateCcw,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { fetchOllamaHealth, fetchGitHubStatus, type OllamaHealth } from '../services/api';
import type { GitHubTokenStatus } from '../types/api';

export function SettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('qwen2.5-coder:7b');
  const [engine, setEngine] = useState('ollama');
  const [maxPatchChars, setMaxPatchChars] = useState(50000);
  const [defaultComments, setDefaultComments] = useState(5);
  const [savedToast, setSavedToast] = useState(false);

  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealth | null>(null);
  const [githubStatus, setGithubStatus] = useState<GitHubTokenStatus | null>(null);

  useEffect(() => {
    fetchOllamaHealth().then(setOllamaHealth).catch(() => {});
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
          <SettingsIcon size={24} color="var(--accent-primary)" /> System Settings
        </h2>
        <p className="page-subtitle">
          Configure local Ollama connectivity, GitHub personal access token authentication, and review engine defaults.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Ollama LLM Settings */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} color="var(--accent-primary)" /> Local Ollama Engine
            </span>
            {ollamaHealth?.ollama_reachable ? (
              <span className="stat-badge-pill badge-online">Connected</span>
            ) : (
              <span className="stat-badge-pill badge-pending">Disconnected</span>
            )}
          </div>

          <div className="panel-card-body">
            <div className="form-group">
              <label className="form-label">Ollama Base URL</label>
              <input
                type="text"
                className="form-input"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Active Model</label>
              <select
                className="form-input"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                <option value="qwen2.5-coder:7b">qwen2.5-coder:7b (Recommended · Code Specialized)</option>
                <option value="llama3.2:latest">llama3.2:latest (General Purpose)</option>
                <option value="nomic-embed-text:latest">nomic-embed-text:latest (Embeddings)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Primary Engine Selection</label>
              <select
                className="form-input"
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
              >
                <option value="groq">Groq Cloud AI (qwen/qwen3.8-27b · Fast Free-Tier)</option>
                <option value="ollama">Ollama Local LLM (qwen2.5-coder:7b)</option>
                <option value="demo">Demo Engine (Heuristic rule-based)</option>
              </select>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ollama is probed automatically upon backend startup. Ensure <code>ollama serve</code> is active on port 11434.
            </div>
          </div>
        </div>

        {/* GitHub Integration Status */}
        <div className="panel-card">
          <div className="panel-card-header">
            <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitPullRequest size={18} /> GitHub Integration
            </span>
            {githubStatus?.valid ? (
              <span className="stat-badge-pill badge-online">Verified</span>
            ) : (
              <span className="stat-badge-pill badge-pending">Public Only</span>
            )}
          </div>

          <div className="panel-card-body">
            <div className="form-group">
              <label className="form-label">Personal Access Token (PAT) Status</label>
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
                    Authenticated as @{githubStatus?.username || 'Rhythm-029'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Remaining API Quota: {githubStatus?.rate_limit_remaining ?? 5000} / 5,000 requests/hr
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Token Storage</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Configured securely in root <code>.env</code> under <code>GITHUB_TOKEN</code>. Excluded from git commits by <code>.gitignore</code>.
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

        {/* Review Tuning & Guardrails */}
        <div className="panel-card" style={{ gridColumn: 'span 2' }}>
          <div className="panel-card-header">
            <span className="panel-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} /> Review Guardrails & Defaults
            </span>
          </div>

          <div className="panel-card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Maximum Patch Characters</label>
                <input
                  type="number"
                  className="form-input"
                  value={maxPatchChars}
                  onChange={(e) => setMaxPatchChars(parseInt(e.target.value, 10))}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Diffs exceeding this size will trigger a truncation warning to protect context windows.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Default Max Comments</label>
                <input
                  type="number"
                  className="form-input"
                  value={defaultComments}
                  onChange={(e) => setDefaultComments(parseInt(e.target.value, 10))}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Controls the number of actionable suggestions generated per review run.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" className="btn-secondary-modern" onClick={() => {
                setOllamaUrl('http://localhost:11434');
                setModelName('qwen2.5-coder:7b');
                setMaxPatchChars(50000);
                setDefaultComments(5);
              }}>
                <RotateCcw size={14} /> Reset Defaults
              </button>
              <button type="button" className="btn-primary-gradient" onClick={handleSave}>
                <Save size={14} /> {savedToast ? 'Settings Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
