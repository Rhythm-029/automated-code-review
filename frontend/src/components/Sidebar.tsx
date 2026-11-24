import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Code2,
  GitPullRequest,
  History,
  Settings,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import type { Page } from '../App';
import { fetchHealth, fetchGitHubStatus } from '../services/api';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: Props) {
  const [healthStatus, setHealthStatus] = useState({
    backend: true,
    github: true,
    db: true,
  });

  useEffect(() => {
    Promise.allSettled([
      fetchHealth(),
      fetchGitHubStatus(),
    ]).then(([hRes, gRes]) => {
      const backendOk = hRes.status === 'fulfilled' && hRes.value.status === 'ok';
      const ghOk = gRes.status === 'fulfilled' && gRes.value.configured && gRes.value.valid;

      setHealthStatus({
        backend: backendOk,
        github: ghOk,
        db: true,
      });
    });
  }, []);

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'review' as Page, label: 'Code Review', icon: Code2 },
    { id: 'github' as Page, label: 'GitHub PR', icon: GitPullRequest },
    { id: 'history' as Page, label: 'Review History', icon: History },
    { id: 'settings' as Page, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div className="sidebar-logo-area">
        <div className="logo-icon-box">
          <Code2 size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div className="logo-text-title">
            CodeReview <span>AI</span>
          </div>
          <div className="logo-text-sub">Automated Code Review Platform</div>
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

      {/* Lower Sidebar Health Widget */}
      <div className="sidebar-widgets">
        <div className="health-widget-card">
          <div className="health-widget-header">
            <span>🛡️ System Status</span>
          </div>
          <div className="health-status-list">
            <div className="health-status-row">
              <span className="health-status-left">
                {healthStatus.backend ? (
                  <CheckCircle2 size={13} className="health-icon-ok" />
                ) : (
                  <AlertTriangle size={13} className="health-icon-warn" />
                )}
                Review Service
              </span>
              <span style={{ fontSize: '0.7rem', color: healthStatus.backend ? 'var(--success)' : 'var(--warning)' }}>
                {healthStatus.backend ? 'Operational' : 'Degraded'}
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
                {healthStatus.github ? 'Connected' : 'Public'}
              </span>
            </div>

            <div className="health-status-row">
              <span className="health-status-left">
                <CheckCircle2 size={13} className="health-icon-ok" />
                History Store
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
