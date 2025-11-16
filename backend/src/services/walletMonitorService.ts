/**
 * Wallet Monitoring Service
 * Coordinates all services to monitor wallets and calculate reputation scores
 */

import { logger } from '../config/logging';
import { Helpers } from '../utils/helpers';
import { Validators } from '../utils/validators';
import { somniaService } from './somniaService';
import { scoringService } from './scoringService';
import { contractService } from './contractService';
import { webSocketService } from './websocketService';
import { blockchainConfig } from '../config/blockchain';
import { WalletEvent } from '../models/WalletEvent';
import { ScoringResult, RiskLevel } from '../models/ScoringResult';
import { WalletMonitoringConfig } from '../models/WalletEvent';

export class WalletMonitorService {
  private static instance: WalletMonitorService;
  private monitoredWallets: Map<string, WalletMonitor> = new Map();
  private isInitialized: boolean = false;
  private readonly SCORE_UPDATE_THRESHOLD = 5; // Minimum score change to trigger update
  private readonly FLAGGING_THRESHOLD = 40; // Score threshold for auto-flagging
  private readonly BATCH_PROCESSING_INTERVAL = 2000; // 2 seconds for faster processing
  private batchProcessingInterval: NodeJS.Timeout | null = null;
  private eventBuffer: Map<string, WalletEvent[]> = new Map();

  // Monitoring configuration
  private readonly MONITORING_CONFIG: WalletMonitoringConfig = {
    includeTransactions: true,
    includeTokenTransfers: true,
    includeInternalTransactions: false,
    fromBlock: undefined
  };

  private constructor() {}

  public static getInstance(): WalletMonitorService {
    if (!WalletMonitorService.instance) {
      WalletMonitorService.instance = new WalletMonitorService();
    }
    return WalletMonitorService.instance;
  }

  /**
   * Initialize wallet monitoring service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Wallet monitor service already initialized');
      return;
    }

    try {
      logger.info('🔄 Initializing wallet monitor service...');

      // Initialize dependent services
      await somniaService.connectToSomnia();
      await scoringService.initialize();
      await contractService.initialize();

      // Start batch processing
      this.startBatchProcessing();

      this.isInitialized = true;
      logger.info('✅ Wallet monitor service initialized successfully', {
        monitoredWallets: this.monitoredWallets.size
      });

    } catch (error) {
      logger.error('❌ Failed to initialize wallet monitor service:', error);
      throw error;
    }
  }

  /**
   * Start monitoring a wallet
   */
  public async startMonitoringWallet(
    walletAddress: string,
    config?: Partial<WalletMonitoringConfig>
  ): Promise<{
    success: boolean;
    message: string;
    existingScore?: ScoringResult | null;
  }> {
    try {
      // Validate wallet address
      const validation = Validators.isValidEthereumAddress(walletAddress);
      if (!validation.isValid) {
        throw new Error(`Invalid wallet address: ${validation.errors.join(', ')}`);
      }

      const normalizedAddress = validation.normalized!;

      // Check if already monitoring
      if (this.monitoredWallets.has(normalizedAddress)) {
        const existingMonitor = this.monitoredWallets.get(normalizedAddress)!;
        logger.debug('Wallet already being monitored', {
          wallet: normalizedAddress,
          since: new Date(existingMonitor.startedAt).toISOString(),
          eventCount: existingMonitor.eventCount
        });

        return {
          success: true,
          message: 'Wallet is already being monitored',
          existingScore: existingMonitor.lastScore
        };
      }

      // Create wallet monitor
      const monitor: WalletMonitor = {
        walletAddress: normalizedAddress,
        startedAt: Date.now(),
        lastActivity: Date.now(),
        eventCount: 0,
        lastScore: null,
        isActive: true,
        config: { ...this.MONITORING_CONFIG, ...config }
      };

      // Subscribe to Somnia events with proper error handling
      try {
        await somniaService.subscribeToWallet(
          normalizedAddress,
          (event: WalletEvent) => this.handleWalletEvent(normalizedAddress, event),
          monitor.config
        );
      } catch (subscriptionError) {
        logger.error('❌ Failed to subscribe to Somnia events:', subscriptionError, {
          wallet: normalizedAddress
        });
        // In demo mode or if subscription fails, we can still proceed with monitoring
        // The system can generate mock events or use historical data
        logger.warn(`⚠️  Using fallback monitoring for wallet ${normalizedAddress} due to subscription error`);
      }

      // Store monitor
      this.monitoredWallets.set(normalizedAddress, monitor);

      // Calculate initial score based on existing blockchain data
      let initialScore: ScoringResult | null = null;

      try {
        // Try to fetch some initial blockchain data for the wallet to calculate a meaningful score
        const provider = blockchainConfig.getProvider();

        // Get basic wallet information to create initial features
        const transactionCount = await provider.getTransactionCount(normalizedAddress as `0x${string}`);
        const balance = await provider.getBalance(normalizedAddress as `0x${string}`);

        logger.info(`Initializing wallet ${normalizedAddress} with ${transactionCount} total transactions and balance ${balance.toString()}`);

        // If there are transactions, get historical transaction data for better features
        let initialEvents: WalletEvent[] = [];

        if (transactionCount > 0) {
          logger.debug(`Fetching historical transactions for ${normalizedAddress} (tx count: ${transactionCount})`);

          // For Somnia network, try to get recent transactions via block range scanning
          const currentBlockNumber = await provider.getBlockNumber();
          const startBlock = Math.max(1, currentBlockNumber - 10000); // Look back up to 10,000 blocks

          // Create a filter for transactions to/from this wallet
          const filter = {
            address: normalizedAddress as `0x${string}`,
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${currentBlockNumber.toString(16)}`
          };

          try {
            const logs = await provider.getLogs(filter);
            logger.info(`Found ${logs.length} logs for ${normalizedAddress} in blocks ${startBlock} to ${currentBlockNumber}`);

            // Process the logs to create initial events - get as many as possible but limit to reasonable number
            const txHashes = [...new Set(logs.map(log => log.transactionHash))]; // Remove duplicates
            const recentTxHashes = txHashes.slice(-20); // Get up to 20 most recent unique transactions

            for (const txHash of recentTxHashes) {
              try {
                const tx = await provider.getTransaction(txHash as `0x${string}`);
                if (tx) {
                  const receipt = await provider.getTransactionReceipt(txHash as `0x${string}`);
                  const block = tx.blockNumber ? await provider.getBlock(tx.blockNumber) : null;

                  initialEvents.push({
                    type: tx.to && (await provider.getCode(tx.to)).length > 2 ? 'contract_interaction' : 'transaction',
                    hash: tx.hash,
                    from: tx.from.toLowerCase(),
                    to: (tx.to || '').toLowerCase(),
                    value: tx.value?.toString() || '0',
                    blockNumber: tx.blockNumber || currentBlockNumber,
                    timestamp: (block?.timestamp ? block.timestamp * 1000 : Date.now()), // Convert to milliseconds
                    gasPrice: tx.gasPrice?.toString() || '0',
                    gasUsed: receipt?.gasUsed?.toString() || '0',
                    status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'success',
                    input: tx.data || '0x',
                    contractAddress: tx.to?.toLowerCase() || '',
                    tokenSymbol: 'SOMNIA',
                    tokenValue: tx.value?.toString() || '0',
                    methodId: tx.data?.substring(0, 10) || '0x',
                    nonce: tx.nonce,
                    position: 0 // Position would need to be retrieved differently
                  });
                }
              } catch (txError: any) {
                logger.warn(`Could not fetch transaction ${txHash} for ${normalizedAddress}:`, txError.message);
                continue; // Continue with other transactions
              }
            }

            logger.info(`Successfully processed ${initialEvents.length} historical transactions for ${normalizedAddress}`);

            // If we found historical transactions, calculate score immediately and broadcast them
            if (initialEvents.length > 0) {
              // Calculate and update score with historical data
              initialScore = await this.calculateAndUpdateScore(normalizedAddress, initialEvents);

              // Immediately broadcast these historical transactions to any connected frontend
              for (const event of initialEvents) {
                webSocketService.broadcastTransactionAlert(
                  normalizedAddress,
                  event,
                  initialScore?.riskLevel || RiskLevel.LOW,
                  0
                );
                logger.info(`Broadcasted historical transaction to WebSocket for ${normalizedAddress}:`, {
                  txHash: event.hash,
                  from: event.from,
                  to: event.to,
                  value: event.value
                });
              }

              logger.info(`Broadcasted ${initialEvents.length} historical transactions to frontend for ${normalizedAddress}`);

              // Also broadcast the score update to ensure frontend gets the latest data
              webSocketService.broadcastScoreUpdate(
                normalizedAddress,
                initialScore
              );
            }
          } catch (logError) {
            logger.error(`Could not fetch logs for ${normalizedAddress}:`, logError);

            // As a fallback, try a different approach to get some recent transactions
            try {
              // Just create a basic event to initialize the wallet
              initialEvents.push({
                type: 'transaction', // Use valid type
                hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                from: normalizedAddress,
                to: normalizedAddress,
                value: balance.toString(),
                blockNumber: currentBlockNumber,
                timestamp: Date.now(),
                gasPrice: '0',
                gasUsed: '0',
                status: 'success',
                input: '0x',
                contractAddress: '',
                tokenSymbol: 'SOMNIA',
                tokenValue: balance.toString(),
                methodId: '0x',
                nonce: 0,
                position: 0
              });
            } catch (fallbackError) {
              logger.error(`Fallback also failed for ${normalizedAddress}:`, fallbackError);
            }
          }
        }

        // If we didn't set initial score from historical transactions, calculate a fresh one
        if (!initialScore) {
          initialScore = await this.calculateAndUpdateScore(normalizedAddress, initialEvents);
        }
      } catch (error) {
        logger.error('Could not fetch initial blockchain data:', error);
        // Fallback to empty events
        initialScore = await this.calculateAndUpdateScore(normalizedAddress, []);
      }

      logger.info('✅ Started monitoring wallet', {
        wallet: normalizedAddress,
        config: monitor.config,
        initialScore: initialScore?.reputationScore,
        initialTransactionCount: initialScore?.transactionCount
      });

      return {
        success: true,
        message: `Started monitoring wallet ${normalizedAddress}`,
        existingScore: initialScore
      };

    } catch (error) {
      logger.error('❌ Failed to start monitoring wallet:', error, {
        wallet: walletAddress
      });

      return {
        success: false,
        message: `Failed to start monitoring: ${error}`
      };
    }
  }

  /**
   * Stop monitoring a wallet
   */
  public async stopMonitoringWallet(walletAddress: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const validation = Validators.isValidEthereumAddress(walletAddress);
      if (!validation.isValid) {
        throw new Error(`Invalid wallet address: ${validation.errors.join(', ')}`);
      }

      const normalizedAddress = validation.normalized!;

      // Check if actually monitoring
      if (!this.monitoredWallets.has(normalizedAddress)) {
        return {
          success: false,
          message: 'Wallet is not being monitored'
        };
      }

      // Unsubscribe from Somnia events
      await somniaService.unsubscribeFromWallet(normalizedAddress);

      // Remove from monitoring
      const monitor = this.monitoredWallets.get(normalizedAddress)!;
      this.monitoredWallets.delete(normalizedAddress);
      this.eventBuffer.delete(normalizedAddress);

      logger.info('🛑 Stopped monitoring wallet', {
        wallet: normalizedAddress,
        duration: Helpers.formatDuration(Date.now() - monitor.startedAt),
        totalEvents: monitor.eventCount
      });

      return {
        success: true,
        message: `Stopped monitoring wallet ${normalizedAddress}`
      };

    } catch (error) {
      logger.error('❌ Failed to stop monitoring wallet:', error, {
        wallet: walletAddress
      });

      return {
        success: false,
        message: `Failed to stop monitoring: ${error}`
      };
    }
  }

  /**
   * Handle incoming wallet event from Somnia - with immediate processing for live updates
   */
  private async handleWalletEvent(walletAddress: string, event: WalletEvent): Promise<void> {
    try {
      // Update monitor activity
      const monitor = this.monitoredWallets.get(walletAddress);
      if (!monitor || !monitor.isActive) {
        logger.warn('Received event for unmonitored wallet:', walletAddress);
        return;
      }

      monitor.lastActivity = Date.now();
      monitor.eventCount++;

      // Process this event immediately for live updates
      await this.processSingleEvent(walletAddress, event);

      // Also buffer event for batch processing
      this.bufferEvent(walletAddress, event);

      logger.debug('📨 Processed wallet event', {
        wallet: walletAddress,
        eventType: event.type,
        hash: event.hash,
        value: event.value,
        totalEvents: monitor.eventCount
      });

    } catch (error) {
      logger.error('Error handling wallet event:', error, {
        wallet: walletAddress,
        event
      });
      // Ensure the error is properly handled and doesn't create an unhandled rejection
    }
  }

  /**
   * Process a single event immediately for live updates
   */
  private async processSingleEvent(walletAddress: string, event: WalletEvent): Promise<void> {
    try {
      // Get the current buffered events for a more complete picture
      const bufferedEvents = this.eventBuffer.get(walletAddress) || [];

      // Add the new event to the buffer temporarily for scoring
      const allEvents = [event, ...bufferedEvents];

      // Calculate score based on this event plus buffered events to update the UI immediately
      const newScore = await this.calculateAndUpdateScore(walletAddress, allEvents);

      if (newScore) {
        logger.info(`✅ Score updated for ${walletAddress} after processing transaction ${event.hash.substring(0, 10)}...`, {
          newScore: newScore.reputationScore,
          riskLevel: newScore.riskLevel,
          transactionCount: allEvents.length
        });

        // Broadcast the transaction alert immediately
        webSocketService.broadcastTransactionAlert(
          walletAddress,
          event,
          newScore.riskLevel,
          0 // For single events, we don't have a previous score to compare
        );

        // Also broadcast the score update for immediate UI feedback
        const monitor = this.monitoredWallets.get(walletAddress);
        webSocketService.broadcastScoreUpdate(walletAddress, newScore, monitor?.lastScore || undefined);
      }
    } catch (error) {
      logger.error('Error processing single event:', error, {
        wallet: walletAddress,
        event
      });
    }
  }

  /**
   * Buffer event for batch processing
   */
  private bufferEvent(walletAddress: string, event: WalletEvent): void {
    if (!this.eventBuffer.has(walletAddress)) {
      this.eventBuffer.set(walletAddress, []);
    }

    const buffer = this.eventBuffer.get(walletAddress)!;
    buffer.push(event);

    // Limit buffer size to prevent memory issues
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 500); // Keep last 500 events
      logger.warn('Event buffer truncated for wallet:', walletAddress);
    }
  }

  /**
   * Start batch processing interval
   */
  private startBatchProcessing(): void {
    this.batchProcessingInterval = setInterval(async () => {
      await this.processBufferedEvents();
    }, this.BATCH_PROCESSING_INTERVAL);

    logger.debug('🔄 Started batch processing interval');
  }

  /**
   * Process buffered events in batches
   */
  private async processBufferedEvents(): Promise<void> {
    if (this.eventBuffer.size === 0) return;

    const processingStart = Date.now();
    let processedWallets = 0;
    let totalEvents = 0;

    // Process each wallet's buffered events
    for (const [walletAddress, events] of this.eventBuffer.entries()) {
      if (events.length === 0) continue;

      try {
        // Calculate new score - only if we have events to process
        if (events.length > 0) {
          const newScore = await this.calculateAndUpdateScore(walletAddress, events);

          if (newScore) {
            // Check if we should flag the wallet
            await this.checkAndFlagWallet(walletAddress, newScore, events);

            // Always broadcast score update when new transactions come in (for live updates)
            const monitor = this.monitoredWallets.get(walletAddress);
            webSocketService.broadcastScoreUpdate(walletAddress, newScore, monitor?.lastScore || undefined);
          }
        }

        processedWallets++;
        totalEvents += events.length;

        // Clear processed events from buffer
        this.eventBuffer.set(walletAddress, []);

      } catch (error) {
        logger.error('Error processing buffered events:', error, {
          wallet: walletAddress,
          eventCount: events.length
        });
        // Don't let a single error stop processing other wallets
      }
    }

    if (processedWallets > 0) {
      logger.debug('✅ Processed buffered events', {
        wallets: processedWallets,
        events: totalEvents,
        processingTime: Date.now() - processingStart
      });
    }
  }

  /**
   * Calculate and update wallet score
   */
  private async calculateAndUpdateScore(
    walletAddress: string,
    events: WalletEvent[]
  ): Promise<ScoringResult | null> {
    try {
      const monitor = this.monitoredWallets.get(walletAddress);
      if (!monitor) return null;

      // Calculate new score
      const newScore = await scoringService.calculateWalletScore(walletAddress, events);

      // Store previous score for comparison
      const previousScore = monitor.lastScore;
      monitor.lastScore = newScore;

      logger.debug(`Score calculated for ${walletAddress}: ${newScore?.reputationScore}`, {
        riskLevel: newScore?.riskLevel,
        eventCount: events.length,
        previousScore: previousScore?.reputationScore
      });

      // Always broadcast score update when transactions come in (for real-time updates)
      if (events.length > 0) {
        webSocketService.broadcastScoreUpdate(walletAddress, newScore, previousScore || undefined);
      } else if (!previousScore || this.isSignificantScoreChange(previousScore, newScore)) {
        // Only broadcast for other changes if it's a significant change
        webSocketService.broadcastScoreUpdate(walletAddress, newScore, previousScore || undefined);
      }

      // Publish score to Somnia data stream for decentralized storage
      if (newScore) {
        try {
          const txHash = await somniaService.publishScoreToStream(
            walletAddress,
            newScore.reputationScore,
            newScore.riskLevel,
            newScore.timestamp
          );

          if (txHash) {
            logger.info(`Published score to Somnia stream: ${txHash}`, {
              wallet: walletAddress,
              score: newScore.reputationScore,
              riskLevel: newScore.riskLevel
            });
          } else {
            logger.warn(`Failed to publish score to Somnia stream for ${walletAddress}`);
          }
        } catch (publishError) {
          logger.error(`Error publishing score to Somnia stream for ${walletAddress}:`, publishError);
          // Don't fail the entire operation if publishing to stream fails
        }
      }

      // Send transaction alert for each event
      if (events.length > 0) {
        for (const event of events) {
          // Broadcast transaction alert for all transactions (for live feed)
          webSocketService.broadcastTransactionAlert(
            walletAddress,
            event,
            newScore?.riskLevel || RiskLevel.LOW,
            previousScore ? newScore!.reputationScore - previousScore.reputationScore : 0
          );
        }
      }

      return newScore;

    } catch (error) {
      logger.error('Error calculating wallet score:', error, {
        wallet: walletAddress,
        eventCount: events.length
      });
      return null;
    }
  }

  /**
   * Check if wallet should be flagged and trigger flagging
   */
  private async checkAndFlagWallet(
    walletAddress: string,
    score: ScoringResult,
    events: WalletEvent[]
  ): Promise<void> {
    try {
      // Check if score is below threshold and not already flagged
      if (score.reputationScore < this.FLAGGING_THRESHOLD && score.riskLevel === RiskLevel.CRITICAL) {
        
        // Check if already flagged on-chain
        const isAlreadyFlagged = await contractService.isWalletFlagged(walletAddress);
        if (isAlreadyFlagged) {
          logger.debug('Wallet already flagged on-chain:', walletAddress);
          return;
        }

        logger.warn('🚨 Critical risk detected - flagging wallet', {
          wallet: walletAddress,
          score: score.reputationScore,
          riskLevel: score.riskLevel,
          events: events.length
        });

        try {
          // Flag wallet on-chain
          const flagResult = await contractService.flagWallet(
            walletAddress,
            score.riskLevel,
            score.reputationScore,
            score.explanation || 'Critical risk score detected'
          );

          if (flagResult.success) {
            // Broadcast flagged event
            webSocketService.broadcastWalletFlagged(
              walletAddress,
              score.riskLevel,
              score.reputationScore,
              flagResult.transactionHash
            );

            logger.info('✅ Wallet flagged on-chain successfully', {
              wallet: walletAddress,
              transactionHash: flagResult.transactionHash,
              score: score.reputationScore
            });
          } else {
            logger.error('❌ Failed to flag wallet on-chain:', flagResult.error, {
              wallet: walletAddress
            });
          }
        } catch (flagError) {
          logger.error('❌ Error flagging wallet on-chain:', flagError, {
            wallet: walletAddress,
            score: score.reputationScore,
            riskLevel: score.riskLevel
          });
        }
      }

    } catch (error) {
      logger.error('Error checking and flagging wallet:', error, {
        wallet: walletAddress
      });
    }
  }

  /**
   * Check if score change is significant enough to trigger update
   */
  private isSignificantScoreChange(previous: ScoringResult, current: ScoringResult): boolean {
    const scoreDiff = Math.abs(previous.reputationScore - current.reputationScore);
    const riskLevelChanged = previous.riskLevel !== current.riskLevel;

    return scoreDiff >= this.SCORE_UPDATE_THRESHOLD || riskLevelChanged;
  }

  /**
   * Get active monitored wallets
   */
  public getActiveWallets(): string[] {
    return Array.from(this.monitoredWallets.keys());
  }

  /**
   * Get wallet monitoring status
   */
  public getWalletStatus(walletAddress: string): WalletMonitor | null {
    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) return null;

    return this.monitoredWallets.get(validation.normalized!) || null;
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats(): {
    totalMonitored: number;
    activeMonitored: number;
    totalEvents: number;
    averageEventsPerWallet: number;
  } {
    let totalEvents = 0;
    let activeMonitored = 0;

    this.monitoredWallets.forEach((monitor) => {
      totalEvents += monitor.eventCount;
      if (monitor.isActive) {
        activeMonitored++;
      }
    });

    return {
      totalMonitored: this.monitoredWallets.size,
      activeMonitored,
      totalEvents,
      averageEventsPerWallet: this.monitoredWallets.size > 0 ? totalEvents / this.monitoredWallets.size : 0
    };
  }

  /**
   * Force score recalculation for a wallet
   */
  public async recalculateScore(walletAddress: string): Promise<ScoringResult | null> {
    try {
      const validation = Validators.isValidEthereumAddress(walletAddress);
      if (!validation.isValid) {
        throw new Error(`Invalid wallet address: ${validation.errors.join(', ')}`);
      }

      const normalizedAddress = validation.normalized!;
      const monitor = this.monitoredWallets.get(normalizedAddress);

      if (!monitor) {
        throw new Error('Wallet is not being monitored');
      }

      // Get buffered events
      const bufferedEvents = this.eventBuffer.get(normalizedAddress) || [];

      // Calculate new score
      const newScore = await this.calculateAndUpdateScore(normalizedAddress, bufferedEvents);

      logger.info('🔄 Force recalculated wallet score', {
        wallet: normalizedAddress,
        score: newScore?.reputationScore,
        riskLevel: newScore?.riskLevel
      });

      return newScore;

    } catch (error) {
      logger.error('Error recalculating wallet score:', error, {
        wallet: walletAddress
      });
      throw error;
    }
  }

  /**
   * Batch start monitoring multiple wallets
   */
  public async batchStartMonitoring(
    wallets: string[],
    config?: Partial<WalletMonitoringConfig>
  ): Promise<{
    success: string[];
    failed: Array<{ wallet: string; error: string }>;
  }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ wallet: string; error: string }>
    };

    logger.info(`🔄 Starting batch monitoring for ${wallets.length} wallets`);

    // Process wallets in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (wallet) => {
        try {
          const result = await this.startMonitoringWallet(wallet, config);
          if (result.success) {
            results.success.push(wallet);
          } else {
            results.failed.push({ wallet, error: result.message });
          }
        } catch (error) {
          results.failed.push({ wallet, error: String(error) });
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < wallets.length) {
        await Helpers.delay(1000);
      }
    }

    logger.info('✅ Batch monitoring completed', {
      successful: results.success.length,
      failed: results.failed.length
    });

    return results;
  }

  /**
   * Health check for wallet monitor service
   */
  public healthCheck(): {
    healthy: boolean;
    details: {
      initialized: boolean;
      totalMonitored: number;
      activeMonitored: number;
      totalEvents: number;
      eventBufferSize: number;
      dependencies: {
        somnia: boolean;
        scoring: boolean;
        contract: boolean;
        websocket: boolean;
      };
    };
  } {
    const stats = this.getMonitoringStats();
    const somniaHealth = somniaService.healthCheck();
    const scoringHealth = scoringService.healthCheck();
    const contractHealth = contractService.getIsInitialized();
    const websocketHealth = webSocketService.healthCheck();

    return {
      healthy: this.isInitialized,
      details: {
        initialized: this.isInitialized,
        totalMonitored: stats.totalMonitored,
        activeMonitored: stats.activeMonitored,
        totalEvents: stats.totalEvents,
        eventBufferSize: this.eventBuffer.size,
        dependencies: {
          somnia: somniaHealth.healthy,
          scoring: scoringHealth.healthy,
          contract: contractHealth,
          websocket: websocketHealth.healthy
        }
      }
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Stop batch processing
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
      this.batchProcessingInterval = null;
    }

    // Stop monitoring all wallets
    const wallets = Array.from(this.monitoredWallets.keys());
    for (const wallet of wallets) {
      await this.stopMonitoringWallet(wallet);
    }

    this.monitoredWallets.clear();
    this.eventBuffer.clear();
    this.isInitialized = false;

    logger.info('✅ Wallet monitor service cleaned up');
  }
}

// Wallet monitor interface
interface WalletMonitor {
  walletAddress: string;
  startedAt: number;
  lastActivity: number;
  eventCount: number;
  lastScore: ScoringResult | null;
  isActive: boolean;
  config: WalletMonitoringConfig;
}

// Export singleton instance
export const walletMonitorService = WalletMonitorService.getInstance();

// Legacy exports for backward compatibility
export const startMonitoringWallet = (wallet: string, config?: Partial<WalletMonitoringConfig>) =>
  walletMonitorService.startMonitoringWallet(wallet, config);
export const stopMonitoringWallet = (wallet: string) =>
  walletMonitorService.stopMonitoringWallet(wallet);
export const getActiveWallets = () => walletMonitorService.getActiveWallets();