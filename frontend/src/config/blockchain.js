/**
 * Blockchain Configuration
 */

export const BLOCKCHAIN_CONFIG = {
  // Somnia Testnet
  SOMNIA_TESTNET: {
    chainId: '0xC498', // 50312 in hex
    chainName: 'Somnia Testnet',
    rpcUrls: ['https://dream-rpc.somnia.network/'],
    blockExplorerUrls: ['https://shannon-explorer.somnia.network/'],
    nativeCurrency: {
      name: 'Somnia Test Token',
      symbol: 'STT',
      decimals: 18
    }
  }
};

// Contract addresses (update with your deployed contract address)
export const CONTRACT_ADDRESSES = {
  WALLET_FLAGGER: import.meta.env.VITE_CONTRACT_ADDRESS || '0xYourDeployedContractAddress'
};

// Risk level configuration
export const RISK_LEVELS = {
  LOW: {
    label: 'Low Risk',
    color: 'green',
    scoreRange: [70, 100],
    description: 'Normal wallet activity'
  },
  MEDIUM: {
    label: 'Medium Risk',
    color: 'yellow',
    scoreRange: [50, 69],
    description: 'Suspicious activity detected'
  },
  HIGH: {
    label: 'High Risk',
    color: 'orange',
    scoreRange: [30, 49],
    description: 'High risk activity patterns'
  },
  CRITICAL: {
    label: 'Critical Risk',
    color: 'red',
    scoreRange: [0, 29],
    description: 'Critical risk - wallet flagged'
  }
};

export default BLOCKCHAIN_CONFIG;