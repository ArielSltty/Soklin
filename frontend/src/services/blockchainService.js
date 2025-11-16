// services/blockchainService.js
import detectEthereumProvider from '@metamask/detect-provider';

class BlockchainService {
  constructor() {
    this.provider = null;
    this.web3 = null;
    this.account = null;
  }

  async connectToMetamask() {
    try {
      // Detect if MetaMask is installed
      this.provider = await detectEthereumProvider();
      
      if (!this.provider) {
        throw new Error('Please install MetaMask to use this feature');
      }

      // Connect to MetaMask
      await this.provider.request({ method: 'eth_requestAccounts' });
      
      // Get the current account
      const accounts = await this.provider.request({ method: 'eth_accounts' });
      this.account = accounts[0];

      // Create Web3 instance
      if (typeof window !== 'undefined' && window.web3) {
        this.web3 = window.web3;
      } else {
        const Web3 = (await import('web3')).default;
        this.web3 = new Web3(this.provider);
      }

      return { success: true, account: this.account };
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      throw error;
    }
  }

  async switchToSomniaTestnet() {
    const somniaChainParams = {
      chainId: '0xC488', // 50312 in decimal (Somnia testnet)
      chainName: 'Somnia Testnet',
      rpcUrls: ['https://dream-rpc.somnia.network/'],
      nativeCurrency: {
        name: 'Somnia',
        symbol: 'SOMNIA',
        decimals: 18
      },
      blockExplorerUrls: ['https://dream-explorer.somnia.network/']
    };

    try {
      // Try to switch to the network
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: somniaChainParams.chainId }],
      });
      return { success: true, message: 'Switched to Somnia Testnet' };
    } catch (switchError) {
      // If the network is not added, add it
      if (switchError.code === 4902) {
        try {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [somniaChainParams],
          });
          return { success: true, message: 'Added and switched to Somnia Testnet' };
        } catch (addError) {
          // If network already exists (different error code), try to switch again
          if (addError.code === -32602 ||
              addError.message.toLowerCase().includes("same rpc endpoint") ||
              addError.message.toLowerCase().includes("already exists")) {
            // Network already exists, try to switch again
            try {
              await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: somniaChainParams.chainId }],
              });
              return { success: true, message: 'Switched to Somnia Testnet' };
            } catch (finalError) {
              console.error('Final error switching to Somnia Testnet:', finalError);
              throw finalError;
            }
          } else {
            console.error('Error adding Somnia Testnet:', addError);
            throw addError;
          }
        }
      } else {
        console.error('Error switching to Somnia Testnet:', switchError);
        throw switchError;
      }
    }
  }

  async connectAndSwitchNetwork() {
    try {
      // First, connect to MetaMask
      const connectResult = await this.connectToMetamask();
      
      if (!connectResult.success) {
        throw new Error('Failed to connect to MetaMask');
      }

      // Then, switch to Somnia Testnet
      const switchResult = await this.switchToSomniaTestnet();

      return { 
        success: true, 
        account: this.account,
        message: switchResult.message 
      };
    } catch (error) {
      console.error('Error in connectAndSwitchNetwork:', error);
      throw error;
    }
  }

  getAccount() {
    return this.account;
  }

  async isConnected() {
    if (!this.provider) {
      return false;
    }

    try {
      const accounts = await this.provider.request({ method: 'eth_accounts' });
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  getConnectionStatus() {
    // Return an object with connection status information
    return {
      isConnected: this.account !== null,
      account: this.account,
      provider: this.provider ? 'MetaMask' : null,
      web3: !!this.web3
    };
  }

  // Additional methods to support useWallet hook
  async connect() {
    try {
      const result = await this.connectAndSwitchNetwork();
      return result.success;
    } catch (error) {
      console.error('Error in connect:', error);
      return false;
    }
  }

  getCurrentAccount() {
    return this.account;
  }

  disconnect() {
    this.provider = null;
    this.web3 = null;
    this.account = null;
  }
}

export const blockchainService = new BlockchainService();