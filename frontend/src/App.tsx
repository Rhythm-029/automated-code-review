import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { ReviewWorkspace } from './pages/ReviewWorkspace';
import { ReviewHistory } from './pages/ReviewHistory';
import { ModelStatusPage } from './pages/ModelStatusPage';
import { GitHubReviewPage } from './pages/GitHubReviewPage';
import { DatasetStatusPage } from './pages/DatasetStatusPage';
import { SettingsPage } from './pages/SettingsPage';
import './index.css';

export type Page =
  | 'dashboard'
  | 'review'
  | 'history'
  | 'model'
  | 'github'
  | 'dataset'
  | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':  return <Dashboard onNavigate={setCurrentPage} />;
      case 'review':     return <ReviewWorkspace />;
      case 'history':    return <ReviewHistory onNavigate={setCurrentPage} />;
      case 'model':      return <ModelStatusPage />;
      case 'github':     return <GitHubReviewPage />;
      case 'dataset':    return <DatasetStatusPage />;
      case 'settings':   return <SettingsPage />;
      default:           return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="main-wrapper">
        <Header onNavigate={setCurrentPage} />
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
