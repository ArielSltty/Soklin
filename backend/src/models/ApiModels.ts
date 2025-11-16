/**
 * API Request and Response Models
 * Defines the structure for HTTP API communication
 */

import { RiskLevel, ScoringResult } from './ScoringResult';

// Request Models
export interface SubscribeWalletRequest {
  wallet: string;
  sessionId?: string;
  includeTransactions?: boolean;
}

export interface UnsubscribeWalletRequest {
  wallet: string;
  sessionId?: string;
}

export interface WalletScoreRequest {
  wallet: string;
  refresh?: boolean;
}

export interface BatchScoreRequest {
  wallets: string[];
}

// Response Models
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
  timestamp: number;
}

export interface WalletScoreResponse {
  wallet: string;
  score: ScoringResult;
  cached: boolean;
  processingTime: number;
}

export interface BatchScoreResponse {
  scores: WalletScoreResponse[];
  processed: number;
  failed: number;
}

export interface SubscriptionResponse {
  wallet: string;
  subscribed: boolean;
  message?: string;
  monitoringStarted?: boolean;
}

export interface SystemStatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  services: {
    blockchain: boolean;
    mlModel: boolean;
    database: boolean;
    websocket: boolean;
  };
  metrics: {
    activeConnections: number;
    monitoredWallets: number;
    totalTransactions: number;
    averageScore: number;
  };
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}

// Validation Models
export interface ValidationResult<T = string> {
  isValid: boolean;
  errors: string[];
  normalized?: T;
}