/**
 * Smart Contract Interaction Models
 * Represents interactions with the WalletFlagger smart contract
 */

export interface ContractConfig {
  address: string;
  abi: any[];
  chainId: number;
  rpcUrl: string;
  gasLimit: number;
  gasPrice?: string;
}

export interface FlagTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber?: number;
  timestamp?: number;
}

export interface WalletFlag {
  wallet: string;
  isFlagged: boolean;
  riskLevel: string;
  reputationScore: number;
  flaggedAt: number;
  expiresAt: number;
  flaggedBy: string;
  reason: string;
  transactionHash?: string;
}

export interface ContractEvent {
  event: 'WalletFlagged' | 'WalletUnflagged' | 'RiskLevelUpdated';
  address: string;
  returnValues: any;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

export interface GasEstimate {
  gasLimit: number;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
}

export interface TransactionReceipt {
  hash: string;
  status: boolean;
  blockNumber: number;
  gasUsed: string;
  effectiveGasPrice: string;
  contractAddress?: string | null;
  events: any[];
}