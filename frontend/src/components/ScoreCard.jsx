import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Shield, TrendingUp, TrendingDown, Activity, BarChart3, Flame, Zap } from 'lucide-react';
import { formatWalletAddress, getRiskColorClass, getRiskIcon, getScoreColor } from '../utils/formatters';
import Charts from './Charts';

const ScoreCard = ({ walletScore, walletAddress, isLoading, onRefresh }) => {
  const [previousScore, setPreviousScore] = useState(null);
  const [scoreChange, setScoreChange] = useState(0);
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    if (walletScore && previousScore && previousScore.reputationScore !== walletScore.reputationScore) {
      setScoreChange(walletScore.reputationScore - previousScore.reputationScore);
    }
    if (walletScore) {
      setPreviousScore(walletScore);
    }
  }, [walletScore]);

  if (!walletScore) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200 h-full shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reputation Score</h3>
            <p className="text-gray-500 text-sm">Real-time risk analysis</p>
          </div>
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-500 text-sm">Loading risk analysis...</div>
        </div>
      </div>
    );
  }

  const {
    reputationScore,
    riskLevel,
    confidence,
    flags = [],
    explanation,
    timestamp
  } = walletScore;

  const riskConfig = {
    low: {
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      status: 'Low Risk',
      icon: <Shield className="text-green-600" size={24} />,
      description: 'Wallet exhibits minimal risk factors'
    },
    medium: {
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      status: 'Medium Risk',
      icon: <AlertTriangle className="text-yellow-600" size={24} />,
      description: 'Wallet shows moderate risk indicators'
    },
    high: {
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      status: 'High Risk',
      icon: <Flame className="text-orange-600" size={24} />,
      description: 'Wallet has significant risk factors'
    },
    critical: {
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      status: 'Critical Risk',
      icon: <Zap className="text-red-600" size={24} />,
      description: 'Wallet flagged for high-risk activities'
    }
  };

  const currentRiskConfig = riskConfig[riskLevel?.toLowerCase()] || riskConfig.low;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 h-full shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Reputation Score</h3>
          <p className="text-gray-500 text-sm">Real-time risk analysis</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Score */}
      <div className="text-center mb-6">
        <div className="relative inline-block">
          <div className={`text-5xl font-bold ${getScoreColor(reputationScore)} mb-1`}>
            {Math.round(reputationScore)}
          </div>
          <div className="text-sm text-gray-500">/ 100</div>

          {/* Score Change Indicator */}
          {scoreChange !== 0 && (
            <div className={`absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full ${
              scoreChange > 0 ? 'bg-green-100 text-green-600 border border-green-300' : 'bg-red-100 text-red-600 border border-red-300'
            }`}>
              {scoreChange > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              <span className="text-xs ml-0.5">{scoreChange > 0 ? '+' : ''}{Math.abs(scoreChange)}</span>
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="text-gray-500 text-sm mt-2 flex items-center justify-center space-x-1">
          <Activity size={12} className="text-gray-400" />
          <span>Confidence: {(confidence * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Risk Level */}
      <div className={`mb-6 p-4 rounded-lg border transition-all duration-300 ${currentRiskConfig.bg} ${currentRiskConfig.border}`}>
        <div className="text-center">
          <div className="flex justify-center mb-2">
            {currentRiskConfig.icon}
          </div>
          <div className={`text-xl font-bold capitalize mb-1 ${currentRiskConfig.color}`}>
            {currentRiskConfig.status}
          </div>
          <div className="text-gray-600 text-sm">
            {currentRiskConfig.description}
          </div>
        </div>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle size={16} className="text-orange-500" />
            <h4 className="text-base font-medium text-gray-900">Risk Indicators</h4>
          </div>
          <div className="space-y-2">
            {flags.map((flag, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-2 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-orange-700 capitalize text-sm flex-1">
                  {flag.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Toggle Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowCharts(!showCharts)}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors duration-200 text-sm font-medium"
        >
          {showCharts ? 'Hide Analytics' : 'Show Analytics'}
        </button>
      </div>

      {/* Charts */}
      {showCharts && (
        <div className="mb-6 pt-4 border-t border-gray-200">
          <Charts walletScore={walletScore} walletAddress={walletAddress} />
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="mb-6">
          <h4 className="text-base font-medium text-gray-900 mb-2 flex items-center space-x-1">
            <BarChart3 size={16} className="text-gray-500" />
            <span>Analysis Summary</span>
          </h4>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-sm leading-relaxed">{explanation}</p>
          </div>
        </div>
      )}

      {/* Wallet Info */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-gray-600 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="font-medium text-gray-900">Wallet:</span>
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">
              {formatWalletAddress(walletAddress)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-900">Last Updated:</span>
            <span>{new Date(timestamp * 1000).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Score Scale */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
          <span>Critical</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500"
            style={{ width: `${reputationScore}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0-29</span>
          <span>30-49</span>
          <span>50-69</span>
          <span>70-100</span>
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;