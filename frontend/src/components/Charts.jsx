import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Charts = ({ walletScore, walletAddress }) => {
  // Generate sample data for charts
  const generateChartData = () => {
    if (!walletScore) return [];
    
    // Create data based on wallet score features
    const baseScore = walletScore.reputationScore || 50;
    const data = [];
    
    for (let i = 0; i < 7; i++) {
      const score = Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 20));
      data.push({
        day: `Day ${i + 1}`,
        score: Math.round(score)
      });
    }
    
    return data;
  };

  const chartData = generateChartData();

  return (
    <div className="space-y-4">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" fill="#3B82F6">
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    entry.score >= 70 ? '#10B981' : 
                    entry.score >= 50 ? '#F59E0B' : 
                    entry.score >= 30 ? '#F97316' : '#EF4444'
                  } 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-xs text-gray-500 text-center">
        Risk Score Trend for {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}` : 'Wallet'}
      </div>
    </div>
  );
};

export default Charts;