import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { useWalletContext } from './contexts/WalletContext';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import './index.css';

function AppContent() {
  const walletContext = useWalletContext();

  const handleStartMonitoring = () => {
    // Use history API to navigate to dashboard
    window.location.hash = '#/dashboard';
  };

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage onStartMonitoring={handleStartMonitoring} />}
      />
      <Route
        path="/dashboard"
        element={
          <Dashboard
            currentWallet={walletContext.currentWallet}
            walletScore={walletContext.walletScore}
            isLoading={walletContext.isLoading}
            error={walletContext.error}
            isSubscribed={walletContext.isSubscribed}
            subscribeToWallet={walletContext.subscribeToWallet}
            unsubscribeFromWallet={walletContext.unsubscribeFromWallet}
            refreshScore={walletContext.refreshScore}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="min-h-screen bg-white">
          <AppContent />
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;