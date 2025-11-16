/**
 * Wallet Management Hook
 */

import { useState, useCallback } from 'react';
import { walletService } from '../services/walletService';
import { blockchainService } from '../services/blockchainService';

export const useWallet = () => {
  const [currentWallet, setCurrentWallet] = useState(null);
  const [walletScore, setWalletScore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribeToWallet = useCallback(async (walletAddress) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate wallet address
      if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid wallet address format');
      }

      // Subscribe to wallet monitoring
      const response = await walletService.subscribeWallet(walletAddress);

      if (response.success) {
        setCurrentWallet(walletAddress);
        setIsSubscribed(true);

        // Get initial score
        const scoreResponse = await walletService.getWalletScore(walletAddress);
        if (scoreResponse.success) {
          setWalletScore(scoreResponse.data.score);

          // Also update transaction history in the context
          if (scoreResponse.data.score.transactionCount > 0) {
            console.log(`Found ${scoreResponse.data.score.transactionCount} historical transactions for ${walletAddress}`);
          }
        }

        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || 'Failed to subscribe to wallet');
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribeFromWallet = useCallback(async () => {
    if (!currentWallet) return;

    setIsLoading(true);
    try {
      const response = await walletService.unsubscribeWallet(currentWallet);
      
      if (response.success) {
        setCurrentWallet(null);
        setWalletScore(null);
        setIsSubscribed(false);
        setError(null);
      }

      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [currentWallet]);

  const refreshScore = useCallback(async () => {
    if (!currentWallet) return;

    setIsLoading(true);
    try {
      const response = await walletService.getWalletScore(currentWallet, true);
      
      if (response.success) {
        setWalletScore(response.data.score);
      }

      return response;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [currentWallet]);

  const getWalletFlagStatus = useCallback(async (walletAddress = currentWallet) => {
    if (!walletAddress) return null;

    try {
      const response = await walletService.getWalletFlagStatus(walletAddress);
      return response;
    } catch (err) {
      console.error('Error getting flag status:', err);
      return null;
    }
  }, [currentWallet]);

  const connectBlockchain = useCallback(async () => {
    try {
      const connected = await blockchainService.connect();
      if (connected) {
        const account = await blockchainService.getCurrentAccount();
        return { success: true, account };
      }
      return { success: false, error: 'Failed to connect to blockchain' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const disconnectBlockchain = useCallback(() => {
    blockchainService.disconnect();
  }, []);

  return {
    // State
    currentWallet,
    walletScore,
    isLoading,
    error,
    isSubscribed,

    // Actions
    subscribeToWallet,
    unsubscribeFromWallet,
    refreshScore,
    getWalletFlagStatus,
    connectBlockchain,
    disconnectBlockchain,

    // Blockchain
    blockchainStatus: blockchainService.getConnectionStatus()
  };
};

export default useWallet;