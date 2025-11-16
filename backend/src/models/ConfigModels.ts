/**
 * Configuration Data Models
 * Defines the structure for application configuration
 */

export interface ServerConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface BlockchainConfig {
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
  privateKey: string;
  gasLimit: number;
  confirmations: number;
}

export interface MLConfig {
  modelPath: string;
  scalerPath: string;
  featuresPath: string;
  blacklistPath: string;
  threshold: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface WebSocketConfig {
  heartbeatInterval: number;
  timeout: number;
  maxConnections: number;
  maxSubscriptions: number;
}

export interface MonitoringConfig {
  checkInterval: number;
  maxRetries: number;
  retryDelay: number;
  cleanupInterval: number;
}

export interface AppConfig {
  server: ServerConfig;
  blockchain: BlockchainConfig;
  ml: MLConfig;
  websocket: WebSocketConfig;
  monitoring: MonitoringConfig;
}