// components/MetamaskConnection.jsx
import React, { useState } from 'react';
import { blockchainService } from '../services/blockchainService';

const MetamaskConnection = ({ onConnected, onCancel }) => {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setError('');
    setConnecting(true);

    try {
      const result = await blockchainService.connectAndSwitchNetwork();
      console.log('MetaMask connection successful:', result);
      onConnected(result);
    } catch (err) {
      console.error('MetaMask connection error:', err);
      setError(err.message || 'Failed to connect to MetaMask');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-10H8v2h2v2h2v-2h2v-2h-2V8h-2v2zm6 4c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-blue-200">Connect to Somnia Testnet to start monitoring</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
              connecting
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white hover:shadow-lg transform hover:scale-105'
            }`}
          >
            {connecting ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Connecting...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 mr-2">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.5 0.937c-5.5 0.5-10 5-9.5 10.5 0.5 5.5 5 10 10.5 9.5 5.5-0.5 10-5 9.5-10.5-0.5-5.5-5-10-10.5-9.5zm-1.5 15.5l-4-4 1.5-1.5 2.5 2.5 6.5-6.5 1.5 1.5-8 8z"/>
                  </svg>
                </div>
                Connect to MetaMask
              </div>
            )}
          </button>

          <button
            onClick={onCancel}
            className="w-full py-3 px-4 bg-white/10 text-blue-200 rounded-xl font-semibold hover:bg-white/20 transition-all duration-300"
          >
            Cancel
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-blue-200/70">
          <p>After connection, you'll be switched to Somnia Testnet</p>
        </div>
      </div>
    </div>
  );
};

export default MetamaskConnection;