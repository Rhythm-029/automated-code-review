import { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  CheckCircle2,
  X,
  Code2,
  GitPullRequest,
  History,
} from 'lucide-react';
import type { Page } from '../App';
import { fetchReviews } from '../services/api';
import type { StoredReview } from '../types/api';

interface Props {
  onNavigate: (page: Page) => void;
}

export function Header({ onNavigate }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [recentReviews, setRecentReviews] = useState<StoredReview[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch recent reviews for search
  useEffect(() => {
    if (searchOpen) {
      fetchReviews(15)
        .then(setRecentReviews)
        .catch(() => {});
    }
  }, [searchOpen]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const filteredReviews = searchQuery.trim()
    ? recentReviews.filter(
        (r) =>
          r.patch_preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.review_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.engine.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.comments.some((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : recentReviews.slice(0, 5);

  return (
    <>
      <header className="top-header">
        {/* Search Bar matching screenshot */}
        <div
          className="header-search-container"
          onClick={() => setSearchOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            className="header-search-input"
            type="text"
            readOnly
            placeholder="Search reviews, repositories, or files..."
          />
          <span className="kbd-badge">⌘ K</span>
        </div>

        {/* Right Action Icons */}
        <div className="header-actions">
          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              className="header-icon-btn"
              title="System Notifications"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell size={18} />
              <span className="notif-badge-dot" />
            </button>

            {notifOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  width: '320px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
                  padding: '16px',
                  zIndex: 50,
                }}
                className="fade-in"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '8px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
                  <button
                    onClick={() => setNotifOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={15} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
                    <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Review Engine Ready</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Automated review pipeline operational.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
                    <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>GitHub Token Verified</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Authenticated as @Rhythm-029 (5,000 req/hr quota).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            className="header-icon-btn"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* User Profile Avatar */}
          <div
            className="user-avatar-circle"
            title="Logged in as halfcuptea"
            style={{ cursor: 'pointer', boxShadow: '0 2px 6px rgba(129, 140, 248, 0.4)' }}
          >
            H
          </div>
        </div>
      </header>

      {/* ⌘ K Quick Search Modal */}
      {searchOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 100,
          }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            style={{
              width: '560px',
              maxWidth: '90vw',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
            className="fade-in"
          >
            {/* Modal Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              <Search size={18} color="var(--accent-primary)" />
              <input
                type="text"
                autoFocus
                placeholder="Type to search past reviews, pages, or comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => setSearchOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Navigation Links */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Quick Jump
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary-modern"
                  onClick={() => {
                    onNavigate('review');
                    setSearchOpen(false);
                  }}
                >
                  <Code2 size={14} /> Code Review
                </button>
                <button
                  className="btn-secondary-modern"
                  onClick={() => {
                    onNavigate('github');
                    setSearchOpen(false);
                  }}
                >
                  <GitPullRequest size={14} /> GitHub PR
                </button>
                <button
                  className="btn-secondary-modern"
                  onClick={() => {
                    onNavigate('history');
                    setSearchOpen(false);
                  }}
                >
                  <History size={14} /> Review History
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                {searchQuery ? 'Matching Reviews' : 'Recent Reviews in Database'}
              </div>

              {filteredReviews.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No matching reviews found.
                </div>
              ) : (
                filteredReviews.map((r) => (
                  <div
                    key={r.review_id}
                    onClick={() => {
                      onNavigate('history');
                      setSearchOpen(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      background: 'var(--bg-subtle)',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {r.comments[0]?.title || `Review (${r.comment_count} comments)`}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {r.patch_preview.slice(0, 50)}…
                      </div>
                    </div>
                    <span className="badge-cat-tag" style={{ fontSize: '0.72rem' }}>
                      Automated Review
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
