/**
 * WebSocket Service
 * Handles real-time communication with frontend clients
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../config/logging';
import { Helpers } from '../utils/helpers';
import { Validators } from '../utils/validators';
import {
  WebSocketMessage,
  WebSocketConnection,
  WSMessageType,
  ScoreUpdateMessage,
  TransactionAlertMessage,
  WalletFlaggedMessage,
  ErrorMessage,
  HeartbeatMessage,
  SubscribeMessage,
  UnsubscribeMessage
} from '../models/WebSocketMessage';
import { ScoringResult, RiskLevel } from '../models/ScoringResult';
import { WalletEvent } from '../models/WalletEvent';

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 300000; // 5 minutes
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Rate limiting
  private readonly RATE_LIMIT = {
    maxMessages: 100,
    windowMs: 60000, // 1 minute
    maxSubscriptions: 50
  };

  private messageCounts: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket service with Socket.IO server
   */
  public setupWebSocket(io: SocketIOServer): void {
    this.io = io;

    // Set up connection handlers
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Handle Socket.IO errors
    this.io.on('error', (error: any) => {
      logger.error('Socket.IO server error:', error);
    });

    // Handle disconnects globally
    this.io.on('disconnect', (reason: string) => {
      logger.info('Global WebSocket disconnect event:', reason);
    });

    // Start background tasks
    this.startHeartbeat();
    this.startCleanup();

    logger.info('✅ WebSocket service initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: Socket): void {
    const connectionId = Helpers.generateUniqueId('ws');
    const clientInfo = this.getClientInfo(socket);

    // Create connection record
    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      subscribedWallets: new Set(),
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.connections.set(connectionId, connection);

    logger.info('🔌 New WebSocket connection', {
      connectionId,
      client: clientInfo,
      totalConnections: this.connections.size
    });

    // Set up message handlers
    this.setupMessageHandlers(socket, connection);

    // Set up disconnect handler
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnect(connectionId, reason);
    });

    // Set up error handler
    socket.on('error', (error: Error) => {
      this.handleError(connectionId, error);
    });

    // Send welcome message
    this.sendMessage(socket, {
      type: WSMessageType.HEARTBEAT,
      id: Helpers.generateUniqueId('msg'),
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        serverTime: Date.now(),
        activeConnections: this.connections.size,
        memoryUsage: process.memoryUsage()
      }
    } as HeartbeatMessage);
  }

  /**
   * Set up message handlers for a socket
   */
  private setupMessageHandlers(socket: Socket, connection: WebSocketConnection): void {
    // Handle subscribe message
    socket.on(WSMessageType.SUBSCRIBE, (data: any) => {
      this.handleSubscribe(connection, data);
    });

    // Handle unsubscribe message
    socket.on(WSMessageType.UNSUBSCRIBE, (data: any) => {
      this.handleUnsubscribe(connection, data);
    });

    // Handle ping message
    socket.on('ping', () => {
      this.handlePing(connection);
    });

    // Handle any other messages
    socket.onAny((eventName: string, data: any) => {
      this.handleGenericMessage(connection, eventName, data);
    });
  }

  /**
   * Handle wallet subscription
   */
  private handleSubscribe(connection: WebSocketConnection, data: any): void {
    try {
      // Update activity timestamp
      connection.lastActivity = Date.now();

      // Check rate limiting
      if (!this.checkRateLimit(connection.id)) {
        this.sendErrorMessage(
          connection.socket,
          'RATE_LIMIT_EXCEEDED',
          'Too many messages, please slow down'
        );
        return;
      }

      // Validate subscription data
      const validation = this.validateSubscribeData(data);
      if (!validation.isValid) {
        this.sendErrorMessage(
          connection.socket,
          'INVALID_SUBSCRIPTION',
          validation.errors.join(', ')
        );
        return;
      }

      const { wallet, sessionId } = validation.normalized!;

      // Check subscription limit
      if (connection.subscribedWallets.size >= this.RATE_LIMIT.maxSubscriptions) {
        this.sendErrorMessage(
          connection.socket,
          'SUBSCRIPTION_LIMIT_EXCEEDED',
          `Maximum ${this.RATE_LIMIT.maxSubscriptions} subscriptions allowed`
        );
        return;
      }

      // Add to subscriptions
      connection.subscribedWallets.add(wallet);
      connection.sessionId = sessionId;

      logger.debug('✅ Wallet subscription added', {
        connectionId: connection.id,
        wallet,
        sessionId,
        totalSubscriptions: connection.subscribedWallets.size
      });

      // Send confirmation
      this.sendMessage(connection.socket, {
        type: WSMessageType.SUBSCRIBE,
        id: Helpers.generateUniqueId('msg'),
        timestamp: Date.now(),
        version: '1.0.0',
        data: {
          wallet,
          sessionId,
          subscribed: true,
          message: `Subscribed to wallet ${wallet}`
        }
      } as SubscribeMessage);

    } catch (error) {
      logger.error('Error handling subscription:', error);
      this.sendErrorMessage(
        connection.socket,
        'SUBSCRIPTION_ERROR',
        'Failed to process subscription'
      );
    }
  }

  /**
   * Handle wallet unsubscription
   */
  private handleUnsubscribe(connection: WebSocketConnection, data: any): void {
    try {
      connection.lastActivity = Date.now();

      // Validate unsubscribe data
      const validation = this.validateUnsubscribeData(data);
      if (!validation.isValid) {
        this.sendErrorMessage(
          connection.socket,
          'INVALID_UNSUBSCRIPTION',
          validation.errors.join(', ')
        );
        return;
      }

      const { wallet, sessionId } = validation.normalized!;

      // Remove from subscriptions
      const wasSubscribed = connection.subscribedWallets.delete(wallet);

      logger.debug('🔓 Wallet unsubscription processed', {
        connectionId: connection.id,
        wallet,
        sessionId,
        wasSubscribed,
        remainingSubscriptions: connection.subscribedWallets.size
      });

      // Send confirmation
      this.sendMessage(connection.socket, {
        type: WSMessageType.UNSUBSCRIBE,
        id: Helpers.generateUniqueId('msg'),
        timestamp: Date.now(),
        version: '1.0.0',
        data: {
          wallet,
          sessionId,
          unsubscribed: wasSubscribed,
          message: wasSubscribed ? `Unsubscribed from wallet ${wallet}` : 'Wallet was not subscribed'
        }
      } as UnsubscribeMessage);

    } catch (error) {
      logger.error('Error handling unsubscription:', error);
      this.sendErrorMessage(
        connection.socket,
        'UNSUBSCRIPTION_ERROR',
        'Failed to process unsubscription'
      );
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(connection: WebSocketConnection): void {
    connection.lastActivity = Date.now();
    
    // Respond with pong
    connection.socket.emit('pong', {
      timestamp: Date.now(),
      serverTime: Date.now()
    });
  }

  /**
   * Handle generic messages
   */
  private handleGenericMessage(connection: WebSocketConnection, eventName: string, data: any): void {
    connection.lastActivity = Date.now();

    logger.debug('Received generic message', {
      connectionId: connection.id,
      eventName,
      data: Validators.sanitizeForLogging(data)
    });

    // For unknown events, send error response
    if (!Object.values(WSMessageType).includes(eventName as WSMessageType)) {
      this.sendErrorMessage(
        connection.socket,
        'UNKNOWN_EVENT',
        `Unknown event type: ${eventName}`
      );
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(connectionId: string, reason: string): void {
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      logger.info('🔌 WebSocket connection disconnected', {
        connectionId,
        reason,
        duration: Date.now() - connection.connectedAt,
        subscriptions: connection.subscribedWallets.size
      });

      this.connections.delete(connectionId);
      this.messageCounts.delete(connectionId);
    }
  }

  /**
   * Handle connection error
   */
  private handleError(connectionId: string, error: Error): void {
    logger.error('💥 WebSocket connection error', {
      connectionId,
      error: error.message
    });

    const connection = this.connections.get(connectionId);
    if (connection) {
      this.sendErrorMessage(
        connection.socket,
        'CONNECTION_ERROR',
        'Connection error occurred'
      );
    }
  }

  /**
   * Broadcast score update to subscribed clients
   */
  public broadcastScoreUpdate(walletAddress: string, score: ScoringResult, previousScore?: ScoringResult): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot broadcast score update');
      return;
    }

    const message: ScoreUpdateMessage = {
      type: WSMessageType.SCORE_UPDATE,
      id: Helpers.generateUniqueId('msg'),
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        wallet: walletAddress,
        score,
        previousScore
      }
    };

    // Find all connections subscribed to this wallet
    let deliveredCount = 0;
    
    this.connections.forEach((connection) => {
      if (connection.subscribedWallets.has(walletAddress.toLowerCase())) {
        this.sendMessage(connection.socket, message);
        deliveredCount++;
      }
    });

    logger.debug('📊 Score update broadcasted', {
      wallet: walletAddress,
      score: score.reputationScore,
      riskLevel: score.riskLevel,
      deliveredTo: deliveredCount,
      totalSubscribers: this.getWalletSubscriberCount(walletAddress)
    });
  }

  /**
   * Broadcast transaction alert
   */
  public broadcastTransactionAlert(
    walletAddress: string,
    transaction: WalletEvent,
    riskLevel: RiskLevel,
    scoreImpact: number
  ): void {
    if (!this.io) {
      return;
    }

    // Ensure transaction has proper timestamp in milliseconds
    if (!transaction.timestamp || transaction.timestamp < 1000000000000) { // If timestamp is in seconds, convert to milliseconds
      transaction.timestamp = Date.now();
    }

    const message: TransactionAlertMessage = {
      type: WSMessageType.TRANSACTION_ALERT,
      id: Helpers.generateUniqueId('msg'),
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        wallet: walletAddress,
        transaction: { ...transaction }, // Create a copy to prevent reference issues
        riskLevel,
        scoreImpact
      }
    };

    this.broadcastToWalletSubscribers(walletAddress, message, 'transaction alert');
  }

  /**
   * Broadcast wallet flagged event
   */
  public broadcastWalletFlagged(
    walletAddress: string,
    riskLevel: RiskLevel,
    score: number,
    contractTxHash?: string
  ): void {
    if (!this.io) {
      return;
    }

    const message: WalletFlaggedMessage = {
      type: WSMessageType.WALLET_FLAGGED,
      id: Helpers.generateUniqueId('msg'),
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        wallet: walletAddress,
        riskLevel,
        score,
        contractTxHash,
        flaggedAt: Date.now()
      }
    };

    this.broadcastToWalletSubscribers(walletAddress, message, 'wallet flagged');
  }

  /**
   * Broadcast message to all subscribers of a wallet
   */
  private broadcastToWalletSubscribers(
    walletAddress: string,
    message: WebSocketMessage,
    messageType: string
  ): void {
    let deliveredCount = 0;
    
    this.connections.forEach((connection) => {
      if (connection.subscribedWallets.has(walletAddress.toLowerCase())) {
        this.sendMessage(connection.socket, message);
        deliveredCount++;
      }
    });

    logger.debug(`📢 ${messageType} broadcasted`, {
      wallet: walletAddress,
      messageType: message.type,
      deliveredTo: deliveredCount
    });
  }

  /**
   * Send message to specific socket
   */
  public sendMessage(socket: Socket, message: WebSocketMessage): void {
    try {
      if (socket && socket.connected) {
        socket.emit(message.type, message);
      } else {
        logger.warn('Attempted to send message to disconnected socket', {
          messageType: message.type,
          messageId: message.id
        });
      }
    } catch (error) {
      logger.error('Error sending WebSocket message:', error, {
        messageType: message.type,
        messageId: message.id
      });
    }
  }

  /**
   * Send error message to socket
   */
  private sendErrorMessage(socket: Socket, code: string, message: string, details?: any): void {
    const errorMessage: ErrorMessage = {
      type: WSMessageType.ERROR,
      id: Helpers.generateUniqueId('msg'),
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        code,
        message,
        details,
        recoverable: !code.includes('FATAL')
      }
    };

    if (socket && socket.connected) {
      this.sendMessage(socket, errorMessage);
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeatToAll();
    }, this.HEARTBEAT_INTERVAL);

    logger.debug('❤️ WebSocket heartbeat started');
  }

  /**
   * Send heartbeat to all connected clients
   */
  private sendHeartbeatToAll(): void {
    if (!this.io || this.connections.size === 0) return;

    const message: HeartbeatMessage = {
      type: WSMessageType.HEARTBEAT,
      id: Helpers.generateUniqueId('msg'),
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        serverTime: Date.now(),
        activeConnections: this.connections.size,
        memoryUsage: process.memoryUsage()
      }
    };

    this.io.emit(WSMessageType.HEARTBEAT, message);

    logger.debug('❤️ Heartbeat sent to all clients', {
      connections: this.connections.size
    });
  }

  /**
   * Start cleanup interval for stale connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Check every minute

    logger.debug('🧹 WebSocket cleanup started');
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    let cleanedCount = 0;

    this.connections.forEach((connection, connectionId) => {
      const inactiveTime = now - connection.lastActivity;
      
      if (inactiveTime > this.CONNECTION_TIMEOUT) {
        logger.info('🧹 Cleaning up stale connection', {
          connectionId,
          inactiveTime: Helpers.formatDuration(inactiveTime),
          subscriptions: connection.subscribedWallets.size
        });

        connection.socket.disconnect(true);
        this.connections.delete(connectionId);
        this.messageCounts.delete(connectionId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up ${cleanedCount} stale connections`);
    }
  }

  /**
   * Check rate limiting for connection
   */
  private checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    let rateInfo = this.messageCounts.get(connectionId);

    if (!rateInfo || now >= rateInfo.resetTime) {
      // Reset or initialize rate limiting
      rateInfo = {
        count: 0,
        resetTime: now + this.RATE_LIMIT.windowMs
      };
      this.messageCounts.set(connectionId, rateInfo);
    }

    rateInfo.count++;

    if (rateInfo.count > this.RATE_LIMIT.maxMessages) {
      logger.warn('Rate limit exceeded', {
        connectionId,
        messageCount: rateInfo.count,
        limit: this.RATE_LIMIT.maxMessages
      });
      return false;
    }

    return true;
  }

  /**
   * Validate subscribe data
   */
  private validateSubscribeData(data: any): { isValid: boolean; errors: string[]; normalized?: any } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format');
      return { isValid: false, errors };
    }

    if (!data.wallet || typeof data.wallet !== 'string') {
      errors.push('Wallet address is required');
    } else {
      const walletValidation = Validators.isValidEthereumAddress(data.wallet);
      if (!walletValidation.isValid) {
        errors.push(...walletValidation.errors);
      }
    }

    if (data.sessionId && typeof data.sessionId !== 'string') {
      errors.push('Session ID must be a string');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      normalized: {
        wallet: Validators.isValidEthereumAddress(data.wallet).normalized!,
        sessionId: data.sessionId || Helpers.generateUniqueId('session')
      }
    };
  }

  /**
   * Validate unsubscribe data
   */
  private validateUnsubscribeData(data: any): { isValid: boolean; errors: string[]; normalized?: any } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format');
      return { isValid: false, errors };
    }

    if (!data.wallet || typeof data.wallet !== 'string') {
      errors.push('Wallet address is required');
    } else {
      const walletValidation = Validators.isValidEthereumAddress(data.wallet);
      if (!walletValidation.isValid) {
        errors.push(...walletValidation.errors);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      normalized: {
        wallet: Validators.isValidEthereumAddress(data.wallet).normalized!,
        sessionId: data.sessionId
      }
    };
  }

  /**
   * Get client information from socket
   */
  private getClientInfo(socket: Socket): any {
    return {
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      origin: socket.handshake.headers.origin
    };
  }

  /**
   * Get number of subscribers for a wallet
   */
  public getWalletSubscriberCount(walletAddress: string): number {
    let count = 0;
    
    this.connections.forEach((connection) => {
      if (connection.subscribedWallets.has(walletAddress.toLowerCase())) {
        count++;
      }
    });

    return count;
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    let activeSubscriptions = 0;

    this.connections.forEach((connection) => {
      totalSubscriptions += connection.subscribedWallets.size;
    });

    // Count unique subscribed wallets across all connections
    const uniqueWallets = new Set();
    this.connections.forEach((connection) => {
      connection.subscribedWallets.forEach(wallet => uniqueWallets.add(wallet));
    });
    activeSubscriptions = uniqueWallets.size;

    return {
      totalConnections: this.connections.size,
      totalSubscriptions,
      activeSubscriptions
    };
  }

  /**
   * Health check for WebSocket service
   */
  public healthCheck(): {
    healthy: boolean;
    details: {
      serverInitialized: boolean;
      totalConnections: number;
      totalSubscriptions: number;
      activeSubscriptions: number;
      memoryUsage: NodeJS.MemoryUsage;
    };
  } {
    const stats = this.getConnectionStats();

    return {
      healthy: !!this.io,
      details: {
        serverInitialized: !!this.io,
        totalConnections: stats.totalConnections,
        totalSubscriptions: stats.totalSubscriptions,
        activeSubscriptions: stats.activeSubscriptions,
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all clients
    this.connections.forEach((connection) => {
      connection.socket.disconnect(true);
    });

    this.connections.clear();
    this.messageCounts.clear();

    logger.info('✅ WebSocket service cleaned up');
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();

// Legacy export for backward compatibility
export const setupWebSocket = (io: SocketIOServer) => webSocketService.setupWebSocket(io);
export const broadcastScoreUpdate = (wallet: string, score: ScoringResult, previousScore?: ScoringResult) =>
  webSocketService.broadcastScoreUpdate(wallet, score, previousScore);