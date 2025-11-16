/**
 * WebSocket Message Data Models
 * Defines real-time communication between backend and frontend
 */

import { ScoringResult, RiskLevel } from './ScoringResult';

export enum WSMessageType {
  SCORE_UPDATE = 'score_update',
  TRANSACTION_ALERT = 'transaction_alert',
  WALLET_FLAGGED = 'wallet_flagged',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe'
}

export interface WSMessage {
  type: WSMessageType;
  id: string;
  timestamp: number;
  version: string;
}

export interface ScoreUpdateMessage extends WSMessage {
  type: WSMessageType.SCORE_UPDATE;
  data: {
    wallet: string;
    score: ScoringResult;
    previousScore?: ScoringResult;
    transaction?: any;
  };
}

export interface TransactionAlertMessage extends WSMessage {
  type: WSMessageType.TRANSACTION_ALERT;
  data: {
    wallet: string;
    transaction: any;
    riskLevel: RiskLevel;
    scoreImpact: number;
  };
}

export interface WalletFlaggedMessage extends WSMessage {
  type: WSMessageType.WALLET_FLAGGED;
  data: {
    wallet: string;
    riskLevel: RiskLevel;
    score: number;
    contractTxHash?: string;
    flaggedAt: number;
  };
}

export interface ErrorMessage extends WSMessage {
  type: WSMessageType.ERROR;
  data: {
    code: string;
    message: string;
    details?: any;
    recoverable: boolean;
  };
}

export interface HeartbeatMessage extends WSMessage {
  type: WSMessageType.HEARTBEAT;
  data: {
    serverTime: number;
    activeConnections: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

export interface SubscribeMessage extends WSMessage {
  type: WSMessageType.SUBSCRIBE;
  data: {
    wallet: string;
    sessionId: string;
  };
}

export interface UnsubscribeMessage extends WSMessage {
  type: WSMessageType.UNSUBSCRIBE;
  data: {
    wallet: string;
    sessionId: string;
  };
}

export type WebSocketMessage = 
  | ScoreUpdateMessage
  | TransactionAlertMessage
  | WalletFlaggedMessage
  | ErrorMessage
  | HeartbeatMessage
  | SubscribeMessage
  | UnsubscribeMessage;

export interface WebSocketConnection {
  id: string;
  socket: any;
  subscribedWallets: Set<string>;
  connectedAt: number;
  lastActivity: number;
  sessionId?: string;
}