/**
 * Wallet Event Data Models
 * Represents blockchain events and transactions from Somnia streams
 */

export interface WalletEvent {
  type: 'transaction' | 'contract_interaction' | 'token_transfer';
  hash: string;
  from: string;
  to?: string;
  value: string;
  blockNumber: number;
  timestamp: number;
  gasPrice: string;
  gasUsed: string;
  status: 'success' | 'failed';
  input?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenValue?: string;
  methodId?: string;
  nonce: number;
  position?: number;
}

export interface TransactionData {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  input: string;
  nonce: number;
  blockHash: string;
  blockNumber: number;
  transactionIndex: number;
}

export interface BlockData {
  number: number;
  hash: string;
  timestamp: number;
  parentHash: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  size: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  transactions: string[];
}

export interface StreamEvent {
  event: 'transaction' | 'block' | 'log';
  data: WalletEvent | BlockData | any;
  chainId: number;
  streamId: string;
}

export interface WalletMonitoringConfig {
  includeTransactions: boolean;
  includeTokenTransfers: boolean;
  includeInternalTransactions: boolean;
  fromBlock?: number;
}