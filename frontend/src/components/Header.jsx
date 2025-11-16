import React from 'react';

const Header = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'monitor', label: 'Wallet Monitor', icon: '🔍' },
    { id: 'dashboard', label: 'Analytics', icon: '📊' },
    { id: 'about', label: 'About', icon: 'ℹ️' }
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="Soklin Logo"
              className="w-10 h-10 rounded-lg bg-gray-100 p-1"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center';
                fallback.innerHTML = '<span class="text-white font-bold text-sm">S</span>';
                e.target.parentNode.replaceChild(fallback, e.target);
              }}
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Soklin</h1>
            </div>
          </div>

          {/* Navigation Tabs - Simplified for cleaner look */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Network Status - Simplified */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Somnia Testnet</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;