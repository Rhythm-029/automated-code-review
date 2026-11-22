import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Code2,
  GitPullRequest,
  History,
  Cpu,
  Settings,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import type { Page } from '../App';
import { fetchHealth, fetchOllamaHealth, fetchGitHubStatus } from '../services/api';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: Props) {
  const [healthStatus, setHealthStatus] = useState({
    backend: true,
    ollama: true,
    github: true,
    db: true,
  });
  const [activeEngineName, setActiveEngineName] = useState('Ollama');
  const [activeModelName, setActiveModelName] = useState('qwen2.5-coder:7b');

  useEffect(() => {
    // Check real system health
    Promise.allSettled([
      fetchHealth(),
      fetchOllamaHealth(),
      fetchGitHubStatus(),
    ]).then(([hRes, oRes, gRes]) => {
      const backendOk = hRes.status === 'fulfilled' && hRes.value.status === 'ok';
      const ollamaOk = oRes.status === 'fulfilled' && oRes.value.ollama_reachable;
      const ghOk = gRes.status === 'fulfilled' && gRes.value.configured && gRes.value.valid;

      setHealthStatus({
        backend: backendOk,
        ollama: ollamaOk,
        github: ghOk,
        db: true, // Local JSON store is active
      });

      if (oRes.status === 'fulfilled' && oRes.value.target_model) {
        setActiveModelName(oRes.value.target_model);
      }
      if (hRes.status === 'fulfilled' && hRes.value.active_engine) {
        setActiveEngineName(hRes.value.active_engine === 'ollama' ? 'Ollama' : 'Demo Engine');
      }
    });
  }, []);

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'review' as Page, label: 'Code Review', icon: Code2 },
    { id: 'github' as Page, label: 'GitHub PR', icon: GitPullRequest },
    { id: 'history' as Page, label: 'Review History', icon: History },
    { id: 'model' as Page, label: 'Model Status', icon: Cpu },
    { id: 'settings' as Page, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Logo matching screenshot */}
      <div className="sidebar-logo-area">
        <div className="logo-icon-box">
          <Code2 size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div className="logo-text-title">
            CodeReview <span>AI</span>
          </div>
          <div className="logo-text-sub">Smarter Code. Better Software.</div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="sidebar-nav-section">
        <div className="nav-section-title">MAIN</div>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar-nav-item ${currentPage === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} strokeWidth={currentPage === id ? 2.5 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Lower Sidebar Widgets matching screenshot */}
      <div className="sidebar-widgets">
        {/* Active Engine Card */}
        <div
          className="engine-widget-card"
          onClick={() => onNavigate('model')}
          title="Click to view Model Status"
        >
          <div className="engine-widget-header">
            <span className="engine-widget-title">
              <span className="engine-pulse-dot" />
              Active Engine
            </span>
          </div>
          <div className="engine-widget-body">
            <div className="engine-widget-info">
              <div className="engine-icon-avatar">
                <Cpu size={16} />
              </div>
              <div>
                <div className="engine-widget-name">{activeEngineName}</div>
                <div className="engine-widget-model">{activeModelName}</div>
              </div>
            </div>
            <ChevronRight size={15} color="var(--text-muted)" />
          </div>
        </div>

        {/* System Health Card */}
        <div className="health-widget-card">
          <div className="health-widget-header">
            <span>🛡️ System Health</span>
          </div>
          <div className="health-status-list">
            <div className="health-status-row">
              <span className="health-status-left">
                {healthStatus.backend ? (
                  <CheckCircle2 size={13} className="health-icon-ok" />
                ) : (
                  <AlertTriangle size={13} className="health-icon-warn" />
                )}
                Backend API
              </span>
              <span style={{ fontSize: '0.7rem', color: healthStatus.backend ? 'var(--success)' : 'var(--warning)' }}>
                {healthStatus.backend ? 'Online' : 'Degraded'}
              </span>
            </div>

            <div className="health-status-row">
              <span className="health-status-left">
                {healthStatus.ollama ? (
                  <CheckCircle2 size={13} className="health-icon-ok" />
                ) : (
                  <AlertTriangle size={13} className="health-icon-warn" />
                )}
                Ollama Service
              </span>
              <span style={{ fontSize: '0.7rem', color: healthStatus.ollama ? 'var(--success)' : 'var(--warning)' }}>
                {healthStatus.ollama ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="health-status-row">
              <span className="health-status-left">
                {healthStatus.github ? (
                  <CheckCircle2 size={13} className="health-icon-ok" />
                ) : (
                  <AlertTriangle size={13} className="health-icon-warn" />
                )}
                GitHub API
              </span>
              <span style={{ fontSize: '0.7rem', color: healthStatus.github ? 'var(--success)' : 'var(--warning)' }}>
                {healthStatus.github ? 'Verified' : 'Public'}
              </span>
            </div>

            <div className="health-status-row">
              <span className="health-status-left">
                <CheckCircle2 size={13} className="health-icon-ok" />
                Database
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="sidebar-user-footer">
        <div className="user-profile-left">
          <div className="user-avatar-circle">H</div>
          <div>
            <div className="user-name-text">halfcuptea</div>
            <div className="user-sub-text">BTech Capstone</div>
          </div>
        </div>
        <ChevronDown size={14} color="var(--text-muted)" />
      </div>
    </aside>
  );
}
