import React, { createContext, useContext } from 'react';
import { useWallet } from '../hooks/useWallet';

// Create Wallet Context
const WalletContext = createContext();

// Wallet Provider Component
export const WalletProvider = ({ children }) => {
  const walletHook = useWallet();

  return (
    <WalletContext.Provider value={walletHook}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use wallet context
export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
};