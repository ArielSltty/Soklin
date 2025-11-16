/**
 * WebSocket Hook for real-time data
 */

import { useState, useEffect, useCallback } from 'react';
import { webSocketService } from '../services/websocketService';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    // Connect to WebSocket
    const socket = webSocketService.connect();

    // Set up event listeners
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (errorData) => {
      setError(errorData);
    };

    const handleReconnect = (attempt) => {
      setReconnectAttempts(attempt);
    };

    // Subscribe to connection events
    webSocketService.on('connect', handleConnect);
    webSocketService.on('disconnect', handleDisconnect);
    webSocketService.on('error', handleError);
    webSocketService.on('reconnect_attempt', handleReconnect);

    // Initial connection status
    const initialStatus = webSocketService.getConnectionStatus();
    setIsConnected(initialStatus.isConnected);
    setReconnectAttempts(initialStatus.reconnectAttempts);

    // Cleanup
    return () => {
      webSocketService.off('connect', handleConnect);
      webSocketService.off('disconnect', handleDisconnect);
      webSocketService.off('error', handleError);
      webSocketService.off('reconnect_attempt', handleReconnect);
    };
  }, []);

  const subscribeToWallet = useCallback((walletAddress) => {
    const result = webSocketService.subscribeToWallet(walletAddress);
    return result;
  }, []);

  const unsubscribeFromWallet = useCallback((walletAddress) => {
    const result = webSocketService.unsubscribeFromWallet(walletAddress);
    return result;
  }, []);

  const onScoreUpdate = useCallback((callback) => {
    webSocketService.on('score_update', callback);
    return () => webSocketService.off('score_update', callback);
  }, []);

  const onTransactionAlert = useCallback((callback) => {
    webSocketService.on('transaction_alert', callback);
    return () => webSocketService.off('transaction_alert', callback);
  }, []);

  const onWalletFlagged = useCallback((callback) => {
    webSocketService.on('wallet_flagged', callback);
    return () => webSocketService.off('wallet_flagged', callback);
  }, []);

  const onHeartbeat = useCallback((callback) => {
    webSocketService.on('heartbeat', callback);
    return () => webSocketService.off('heartbeat', callback);
  }, []);

  return {
    isConnected,
    lastMessage,
    error,
    reconnectAttempts,
    subscribeToWallet,
    unsubscribeFromWallet,
    onScoreUpdate,
    onTransactionAlert,
    onWalletFlagged,
    onHeartbeat,
    connectionStatus: webSocketService.getConnectionStatus()
  };
};

export default useWebSocket;