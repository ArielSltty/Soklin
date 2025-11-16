import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WalletInput from './WalletInput';
import ScoreCard from './ScoreCard';
import LiveTable from './LiveTable';
import SystemStatus from './SystemStatus';
import EnhancedVisualization from './EnhancedVisualization';
import LiveDashboard from './LiveDashboard';
import Chat from './Chat';

const Dashboard = ({
  currentWallet,
  walletScore,
  isLoading,
  error,
  isSubscribed,
  subscribeToWallet,
  unsubscribeFromWallet,
  refreshScore
}) => {
  const [showWalletInput, setShowWalletInput] = useState(!currentWallet);
  const [activeTab, setActiveTab] = useState('overview');

  const handleWalletSubmit = async (walletAddress) => {
    const result = await subscribeToWallet(walletAddress);
    if (result.success) {
      setShowWalletInput(false);
      console.log('✅ Subscribed to wallet:', walletAddress);
    } else {
      console.error('❌ Failed to subscribe to wallet:', result.error);
    }
  };

  const handleWalletUnsubscribe = async () => {
    await unsubscribeFromWallet();
    setShowWalletInput(true);
    console.log('🔓 Unsubscribed from wallet');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Dashboard Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link to="/" className="flex items-center space-x-2">
                <div className="relative w-8 h-8">
                  <img
                    src="/logo.png"
                    alt="Soklin Logo"
                    className="w-8 h-8 rounded-lg object-contain"
                    onError={(e) => {
                      // If logo.png doesn't exist, show fallback
                      e.target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.className = 'w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center';
                      fallback.innerHTML = '<span class="text-white font-bold text-sm">S</span>';
                      e.target.parentNode.replaceChild(fallback, e.target);
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Soklin</h1>
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200 text-sm"
              >
                Home
              </Link>
              <div className="text-sm text-gray-600">
                Real-time Monitoring
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* System Status Bar */}
        <div className="mb-6">
          <SystemStatus />
        </div>

        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* Wallet Input Section - Only show if no wallet is monitored */}
          {showWalletInput && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Wallet Analysis</h2>
              <WalletInput
                onWalletSubmit={handleWalletSubmit}
                onWalletUnsubscribe={handleWalletUnsubscribe}
                currentWallet={currentWallet}
                isLoading={isLoading}
                error={error}
                isSubscribed={isSubscribed}
              />
            </div>
          )}

          {/* Dashboard Content - Show when wallet is active */}
          {currentWallet && isSubscribed && (
            <div>
              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'overview'
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'transactions'
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'analytics'
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'chat'
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Community Chat
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Score Card */}
                  <div className="lg:col-span-1">
                    <div className="card">
                      <ScoreCard
                        walletScore={walletScore}
                        walletAddress={currentWallet}
                        isLoading={isLoading}
                        onRefresh={refreshScore}
                      />
                    </div>
                  </div>

                  {/* Live Transactions Table */}
                  <div className="lg:col-span-2">
                    <div className="card">
                      <LiveTable
                        walletAddress={currentWallet}
                        walletScore={walletScore}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="grid grid-cols-1 gap-6">
                  <div className="card">
                    <LiveTable
                      walletAddress={currentWallet}
                      walletScore={walletScore}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div>
                  <LiveDashboard walletScore={walletScore} />
                  <div className="mt-6">
                    <EnhancedVisualization
                      walletAddress={currentWallet}
                      walletScore={walletScore}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="card">
                      <LiveTable
                        walletAddress={currentWallet}
                        walletScore={walletScore}
                      />
                    </div>
                  </div>
                  <div className="lg:col-span-1">
                    <Chat walletAddress={currentWallet} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Welcome Message - When no wallet is active */}
          {!currentWallet && showWalletInput && (
            <div className="text-center py-12">
              <div className="card p-8 max-w-3xl mx-auto">
                <div className="text-4xl mb-6">🔍</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Advanced Blockchain Monitoring Platform
                </h2>
                <p className="text-gray-600 text-base mb-8">
                  Monitor wallet activities, detect suspicious patterns, and analyze real-time blockchain transactions with our AI-powered security system.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl mb-2">📊</div>
                    <h3 className="font-semibold text-gray-900 mb-1">Real-time Scoring</h3>
                    <p className="text-sm text-gray-600">Advanced ML-powered reputation analysis</p>
                  </div>
                  <div className="text-center p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl mb-2">🚨</div>
                    <h3 className="font-semibold text-gray-900 mb-1">Risk Detection</h3>
                    <p className="text-sm text-gray-600">Automated fraud detection system</p>
                  </div>
                  <div className="text-center p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl mb-2">💬</div>
                    <h3 className="font-semibold text-gray-900 mb-1">Community Chat</h3>
                    <p className="text-sm text-gray-600">Collaborate with other security experts</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;