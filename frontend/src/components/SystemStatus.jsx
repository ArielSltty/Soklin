import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

const SystemStatus = () => {
  const { isConnected: isWsConnected, connectionStatus } = useWebSocket();
  const [systemStatus, setSystemStatus] = useState('checking');
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    // Simulate system status check
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
      // In a real app, this would call an API endpoint
      setSystemStatus(isWsConnected ? 'healthy' : 'degraded');
    }, 10000);

    return () => clearInterval(interval);
  }, [isWsConnected]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle size={18} className="text-green-400" />;
      case 'degraded': return <AlertTriangle size={18} className="text-yellow-400" />;
      case 'unhealthy': return <WifiOff size={18} className="text-red-400" />;
      default: return <Clock size={18} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/10 rounded-lg">
              {getStatusIcon(systemStatus)}
            </div>
            <div>
              <div className={`font-semibold ${getStatusColor(systemStatus)}`}>
                {isWsConnected ? 'Secure Connection' : 'Connection Issue'}
              </div>
              <div className="text-blue-200 text-xs">Live Monitoring</div>
            </div>
          </div>

          {/* Platform Status */}
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <div className="w-4 h-4 bg-green-400 rounded-full"></div>
            </div>
            <div>
              <div className="text-white font-semibold">Operational</div>
              <div className="text-blue-200 text-xs">Analytics Platform</div>
            </div>
          </div>

          {/* Data Sync Status */}
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <div className="w-4 h-4 bg-green-400 rounded-full"></div>
            </div>
            <div>
              <div className="text-white font-semibold">Sync Active</div>
              <div className="text-blue-200 text-xs">Real-time Data</div>
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="text-right">
          <div className="text-blue-200 text-xs">Updated</div>
          <div className="text-white font-medium text-sm">
            {new Date(lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;