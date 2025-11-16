import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, Shield, Users, Activity } from 'lucide-react';
import { useWalletContext } from '../contexts/WalletContext';

const EnhancedVisualization = ({ walletAddress, walletScore }) => {
  const [chartData, setChartData] = useState([]);
  const [riskTrend, setRiskTrend] = useState([]);
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    avgRiskScore: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0
  });

  // Generate sample data for visualization
  useEffect(() => {
    if (walletScore) {
      // Create risk trend data
      const trendData = [];
      const baseScore = walletScore.reputationScore || 50;
      
      for (let i = 0; i < 12; i++) {
        const score = Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 20 + i * 0.5));
        trendData.push({
          month: `Day ${i + 1}`,
          score: Math.round(score)
        });
      }
      setRiskTrend(trendData);

      // Generate transaction data
      const data = [];
      for (let i = 0; i < 7; i++) {
        data.push({
          day: `Day ${i + 1}`,
          transactions: Math.floor(Math.random() * 50) + 10,
          volume: Math.random() * 100 + 10
        });
      }
      setChartData(data);

      // Calculate metrics
      setMetrics({
        totalTransactions: walletScore.transactionCount || 0,
        avgRiskScore: walletScore.reputationScore || 0,
        highRiskCount: walletScore.reputationScore < 30 ? 1 : 0,
        mediumRiskCount: walletScore.reputationScore >= 30 && walletScore.reputationScore < 70 ? 1 : 0,
        lowRiskCount: walletScore.reputationScore >= 70 ? 1 : 0
      });
    }
  }, [walletScore]);

  // Risk distribution data
  const riskDistribution = [
    { name: 'Low Risk', value: metrics.lowRiskCount, color: '#10B981' },
    { name: 'Medium Risk', value: metrics.mediumRiskCount, color: '#F59E0B' },
    { name: 'High Risk', value: metrics.highRiskCount, color: '#EF4444' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk Trend Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Risk Score Trend</h3>
          <TrendingUp size={20} className="text-blue-600" />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction Volume Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transaction Volume</h3>
          <Activity size={20} className="text-green-600" />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="transactions" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Risk Distribution</h3>
          <AlertTriangle size={20} className="text-yellow-600" />
        </div>
        <div className="h-64 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metrics Card */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 bg-blue-50 border-blue-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Transactions</p>
              <p className="text-2xl font-bold text-blue-600">{metrics.totalTransactions}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4 bg-green-50 border-green-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Risk Score</p>
              <p className="text-2xl font-bold text-green-600">{metrics.avgRiskScore}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4 bg-yellow-50 border-yellow-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle size={16} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Medium Risk</p>
              <p className="text-2xl font-bold text-yellow-600">{metrics.mediumRiskCount}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4 bg-red-50 border-red-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Users size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">High Risk</p>
              <p className="text-2xl font-bold text-red-600">{metrics.highRiskCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVisualization;