import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertTriangle, Clock, Wallet, Users, Globe, Zap } from 'lucide-react';

const LiveDashboard = ({ walletScore }) => {
  const [metrics, setMetrics] = useState({
    totalAddresses: 1247,
    activeMonitoring: 42,
    alertsToday: 18,
    transactionsPerSecond: 3.2,
    avgRiskScore: 67,
    uptime: 99.8,
    connectedUsers: 23,
    totalAlerts: 156
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        totalAddresses: prev.totalAddresses + Math.floor(Math.random() * 3),
        activeMonitoring: prev.activeMonitoring + (Math.random() > 0.7 ? 1 : 0),
        alertsToday: prev.alertsToday + (Math.random() > 0.8 ? 1 : 0),
        transactionsPerSecond: (Math.random() * 5).toFixed(1),
        connectedUsers: Math.max(10, prev.connectedUsers + Math.floor(Math.random() * 3 - 1))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Update avgRiskScore when walletScore changes
  useEffect(() => {
    if (walletScore) {
      setMetrics(prev => ({
        ...prev,
        avgRiskScore: walletScore.reputationScore || prev.avgRiskScore
      }));
    }
  }, [walletScore]);

  const metricCards = [
    {
      title: 'Total Addresses Monitored',
      value: metrics.totalAddresses.toLocaleString(),
      icon: <Globe size={20} />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Monitoring',
      value: metrics.activeMonitoring,
      icon: <Activity size={20} />,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Alerts Today',
      value: metrics.alertsToday,
      icon: <AlertTriangle size={20} />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Transactions/Sec',
      value: metrics.transactionsPerSecond,
      icon: <Zap size={20} />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Avg Risk Score',
      value: metrics.avgRiskScore,
      icon: <TrendingUp size={20} />,
      color: metrics.avgRiskScore > 70 ? 'text-green-600' : metrics.avgRiskScore > 40 ? 'text-yellow-600' : 'text-red-600',
      bgColor: metrics.avgRiskScore > 70 ? 'bg-green-50' : metrics.avgRiskScore > 40 ? 'bg-yellow-50' : 'bg-red-50'
    },
    {
      title: 'Uptime',
      value: `${metrics.uptime}%`,
      icon: <Clock size={20} />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Connected Users',
      value: metrics.connectedUsers,
      icon: <Users size={20} />,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    {
      title: 'Total Alerts',
      value: metrics.totalAlerts,
      icon: <Wallet size={20} />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Live Monitoring Dashboard</h2>
          <p className="text-gray-600">Real-time blockchain monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {/* Real-time metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metricCards.map((metric, index) => (
          <div key={index} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <div className={metric.color}>{metric.icon}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status indicators */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Monitoring Active</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Data Streaming</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span className="text-sm text-gray-600">ML Analysis</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Alert System</span>
        </div>
      </div>

      {/* System status bar */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">System Status</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600">All Systems Operational</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Last Update</p>
            <p className="text-sm text-gray-700">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDashboard;