/**
 * Somnia Blockchain Data Stream Service
 * Handles real-time data streaming from Somnia blockchain
 * Falls back to demo mode if Somnia SDK is not available
 */

import { createPublicClient, http, Address, createWalletClient, createTransport, toHex } from 'viem';
import { ethers } from 'ethers';
import axios from 'axios';
import { logger } from '../config/logging';
import { blockchainConfig } from '../config/blockchain';
import { Helpers } from '../utils/helpers';
import { Validators } from '../utils/validators';
import { WalletEvent, BlockData, WalletMonitoringConfig } from '../models/WalletEvent';
import { SDK, SubscriptionInitParams, zeroBytes32 } from '@somnia-chain/streams';

export class SomniaService {
  private static instance: SomniaService;
  private isConnected: boolean = false;
  private subscribedWallets: Set<string> = new Set();
  private eventCallbacks: Map<string, (event: WalletEvent) => void> = new Map();
  private blockCallbacks: Map<string, (block: any) => void> = new Map();
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private somniaSDK: SDK | null = null;

  // Track active subscriptions
  private activeSubscriptions: Map<string, { unsubscribe: () => void }> = new Map();

  // Remove demo mode - always use real mode
  private get isDemoMode(): boolean {
    return false; // Always use real mode
  }

  private constructor() {}

  public static getInstance(): SomniaService {
    if (!SomniaService.instance) {
      SomniaService.instance = new SomniaService();
    }
    return SomniaService.instance;
  }

  /**
   * Connect to Somnia data streams or initialize in demo mode
   */
  public async connectToSomnia(): Promise<void> {
    if (this.isConnected) {
      logger.debug('Already connected to Somnia streams');
      return;
    }

    try {
      logger.info('🔄 Connecting to Somnia data streams...');

      // Initialize blockchain config first (this will connect to the blockchain)
      await blockchainConfig.initialize();

      // Get the provider from blockchain config to create the SDK client
      const provider = blockchainConfig.getProvider();

      // Check if we have the required environment variables for real connection
      const somniaRpcUrl = process.env.SOMNIA_RPC_URL;
      if (!somniaRpcUrl || somniaRpcUrl === '') {
        logger.error('❌ SOMNIA_RPC_URL not configured, unable to initialize Somnia SDK');
        throw new Error('SOMNIA_RPC_URL is required for real mode operation');
      } else {
        // Initialize the Somnia SDK with proper chain configuration
        try {
          // Create viem public client with proper chain configuration for Somnia
          const viemPublicClient = createPublicClient({
            transport: http(somniaRpcUrl),
            chain: {
              id: parseInt(process.env.SOMNIA_CHAIN_ID || '50312'),
              name: 'Somnia',
              nativeCurrency: {
                name: 'SOMNIA',
                symbol: 'SOMNIA',
                decimals: 18
              },
              rpcUrls: {
                default: {
                  http: [somniaRpcUrl],
                  webSocket: [somniaRpcUrl.replace('http', 'ws')] // Add WebSocket URL if available
                }
              }
            }
          });

          // Create wallet client if private key is available
          let viemWalletClient;
          if (process.env.PRIVATE_KEY) {
            viemWalletClient = createWalletClient({
              transport: http(somniaRpcUrl),
              chain: {
                id: parseInt(process.env.SOMNIA_CHAIN_ID || '50312'),
                name: 'Somnia',
                nativeCurrency: {
                  name: 'SOMNIA',
                  symbol: 'SOMNIA',
                  decimals: 18
                },
                rpcUrls: {
                  default: {
                    http: [somniaRpcUrl],
                    webSocket: [somniaRpcUrl.replace('http', 'ws')] // Add WebSocket URL if available
                  }
                }
              }
            });
          }

          const clientConfig = {
            public: viemPublicClient,
            ...(viemWalletClient ? { wallet: viemWalletClient } : {})
          };

          // Initialize the Somnia SDK with proper error handling
          this.somniaSDK = new SDK(clientConfig);
          logger.info('✅ Somnia SDK initialized successfully with chain config');

        } catch (sdkInitError) {
          logger.error('❌ Somnia SDK initialization failed:', sdkInitError);
          throw new Error(`Somnia SDK initialization failed: ${sdkInitError}`);
        }
      }

      logger.info('✅ Connected to Somnia data streams successfully', {
        network: 'testnet',
        subscribedWallets: this.subscribedWallets.size,
        endpoint: somniaRpcUrl,
        sdkInitialized: !!this.somniaSDK,
        providerInitialized: !!provider
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

    } catch (error) {
      logger.error('❌ Failed to connect to blockchain config:', error);
      throw error;
    }
  }



  /**
   * Subscribe to wallet events - with demo mode fallback
   */
  public async subscribeToWallet(
    walletAddress: string,
    callback: (event: WalletEvent) => void,
    config?: Partial<WalletMonitoringConfig>
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Somnia service not connected');
    }

    // Validate wallet address
    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) {
      throw new Error(`Invalid wallet address: ${validation.errors.join(', ')}`);
    }

    const normalizedWallet = validation.normalized!;

    logger.info('📥 Subscribing to wallet events', {
      wallet: normalizedWallet,
      config,
      demoMode: this.isDemoMode
    });

    // Add to subscribed wallets
    this.subscribedWallets.add(normalizedWallet);
    this.eventCallbacks.set(normalizedWallet, callback);

    try {
      // Prioritize real mode with proper Somnia SDK subscription
      let subscriptionSuccess = false;

      if (this.somniaSDK) {
        try {
          await this.subscribeToWalletReal(normalizedWallet, callback, config);
          subscriptionSuccess = true;
          logger.debug(`Successfully subscribed to wallet ${normalizedWallet} via Somnia SDK`);
        } catch (sdkError) {
          logger.error(`Somnia SDK subscription failed for ${normalizedWallet}:`, sdkError);
          logger.warn('Falling back to provider polling:', sdkError);
        }
      }

      // Use provider polling as fallback or primary if SDK fails
      if (!subscriptionSuccess) {
        await this.setupProviderPolling(normalizedWallet, callback, config);
      }

      logger.info('✅ Subscribed to wallet events', {
        wallet: normalizedWallet,
        method: subscriptionSuccess ? 'somnia_sdk' : 'provider_polling'
      });
    } catch (error) {
      logger.error('❌ Error subscribing to wallet events:', error);
      // Clean up tracking
      this.subscribedWallets.delete(normalizedWallet);
      this.eventCallbacks.delete(normalizedWallet);
      throw error;
    }
  }

  /**
   * Demo mode: Start simulation for wallet events
   */
  private startDemoModeSimulation(
    walletAddress: string,
    callback: (event: WalletEvent) => void
  ): void {
    // Generate mock events periodically for demo purposes
    const intervalId = setInterval(() => {
      if (!this.subscribedWallets.has(walletAddress)) {
        clearInterval(intervalId);
        return;
      }

      // Create a mock wallet event
      const mockEvent: WalletEvent = {
        type: Math.random() > 0.5 ? 'token_transfer' : 'transaction',
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        from: Math.random() > 0.5 ? walletAddress : Helpers.generateRandomAddress(),
        to: Math.random() > 0.5 ? Helpers.generateRandomAddress() : walletAddress,
        value: (Math.random() * 10).toFixed(6),
        blockNumber: Math.floor(Math.random() * 1000000) + 1,
        timestamp: Date.now(),
        gasPrice: '20000000000',
        gasUsed: '50000',
        status: Math.random() > 0.1 ? 'success' : 'failed',
        input: '0x',
        contractAddress: '',
        tokenSymbol: Math.random() > 0.5 ? 'ETH' : 'SOMNIA',
        tokenValue: (Math.random() * 5).toFixed(6),
        methodId: '0x',
        nonce: Math.floor(Math.random() * 100),
        position: Math.floor(Math.random() * 100)
      };

      callback(mockEvent);
    }, 5000 + Math.random() * 10000); // Random interval between 5-15 seconds

    // Store interval ID as a mock subscription
    this.activeSubscriptions.set(walletAddress, {
      unsubscribe: () => clearInterval(intervalId)
    });
  }

  /**
   * Real mode: Subscribe to wallet events using Somnia SDK
   */
  private async subscribeToWalletReal(
    walletAddress: string,
    callback: (event: WalletEvent) => void,
    config?: Partial<WalletMonitoringConfig>
  ): Promise<void> {
    try {
      if (!this.somniaSDK) {
        throw new Error('Somnia SDK not initialized');
      }

      logger.debug(`Subscribing to wallet ${walletAddress} using Somnia SDK`);

      // First, register a schema for wallet transaction data if not already registered
      await this.registerTransactionSchema();

      // According to Somnia documentation, we need to create a proper subscription
      // for monitoring transactions to/from a specific wallet address
      // We'll use a more targeted approach with proper event subscription

      // Register an event schema for transaction monitoring
      await this.registerTransactionEventSchema();

      // Create ethCalls to monitor specific wallet transactions
      const { encodeFunctionData } = await import('viem'); // Dynamically import viem functions

      const ethCalls: any[] = [
        // Get basic account info
      ];

      // Create a subscription to monitor wallet-specific events
      const subscriptionParams: SubscriptionInitParams = {
        somniaStreamsEventId: 'WalletTransaction', // Use the registered event ID
        ethCalls,
        // context: ["address"], // Monitor by address - commenting out to fix type issue
        onData: async (data: any) => {
          try {
            logger.debug(`Received data from Somnia SDK for wallet ${walletAddress}:`, data);

            // Process the received data and convert to WalletEvent format
            const events = await this.processSomniaData(data, walletAddress);
            if (events && events.length > 0) {
              events.forEach(event => callback(event));
            } else {
              // If Somnia SDK didn't provide events directly, try to fetch wallet transactions
              await this.fetchWalletTransactionsForSomnia(walletAddress, callback);
            }
          } catch (convertError) {
            logger.error('Error processing Somnia SDK data:', convertError);
          }
        },
        onError: (error: Error) => {
          logger.error(`Somnia SDK subscription error for wallet ${walletAddress}:`, error);
          // Fallback to provider polling if Somnia SDK fails
          this.setupProviderPolling(walletAddress, callback, config);
        },
        onlyPushChanges: true // Only trigger callback when there are actual changes
      };

      try {
        // Subscribe using the Somnia SDK
        const subscriptionResult = await this.somniaSDK.streams.subscribe(subscriptionParams);

        if (subscriptionResult && subscriptionResult.subscriptionId) {
          // Store the subscription with unsubscribe function
          const realSubscription = {
            unsubscribe: () => {
              logger.debug(`Unsubscribing from wallet ${walletAddress} via Somnia SDK`);
              subscriptionResult.unsubscribe();
            }
          };

          this.activeSubscriptions.set(walletAddress, realSubscription);
          logger.info(`✅ Successfully subscribed to wallet ${walletAddress} using Somnia SDK with ID: ${subscriptionResult.subscriptionId}`);
        } else {
          logger.warn(`Somnia SDK did not return a valid subscription for wallet ${walletAddress}`);
          // Fallback to provider polling
          throw new Error('Somnia SDK subscription failed to initialize');
        }
      } catch (subscribeError) {
        logger.error(`Somnia SDK subscription failed for ${walletAddress}:`, subscribeError);
        // Fallback to provider polling
        throw new Error(`Somnia SDK subscription failed: ${subscribeError}`);
      }

    } catch (error) {
      logger.error('Error in real wallet subscription via Somnia SDK:', error);
      throw error;
    }
  }

  /**
   * Register the transaction schema with Somnia streams
   */
  private async registerTransactionSchema(): Promise<void> {
    if (!this.somniaSDK) {
      throw new Error('Somnia SDK not initialized');
    }

    try {
      // Define the transaction schema according to Somnia documentation
      const transactionSchema = `uint64 timestamp, string transactionType, address from, address to, uint256 value, uint256 gasPrice, uint256 gasUsed, uint256 blockNumber, string status, string input, string contractAddress, string tokenSymbol, uint256 tokenValue, string methodId`;

      // Check if schema is already registered - handle potential null result
      const schemaIdRaw = await this.somniaSDK.streams.computeSchemaId(transactionSchema);
      if (!schemaIdRaw) {
        throw new Error('Failed to compute schema ID for transaction schema');
      }
      const schemaId: `0x${string}` = schemaIdRaw;
      const isRegistered = await this.somniaSDK.streams.isDataSchemaRegistered(schemaId);

      if (!isRegistered) {
        // Register the schema
        const registrationResult = await this.somniaSDK.streams.registerDataSchemas([
          {
            id: toHex("transaction", { size: 32 }),
            schema: transactionSchema,
            parentSchemaId: zeroBytes32 // Use the imported constant
          } as any
        ]); // only pass the registrations array

        if (registrationResult) {
          logger.info('✅ Transaction schema registered successfully');
        } else {
          logger.warn('⚠️  Transaction schema registration may have failed');
        }
      } else {
        logger.debug('Transaction schema already registered');
      }
    } catch (error) {
      logger.error('Error registering transaction schema:', error);
      throw error;
    }
  }

  /**
   * Register event schema for wallet transaction monitoring
   */
  private async registerTransactionEventSchema(): Promise<void> {
    if (!this.somniaSDK) {
      throw new Error('Somnia SDK not initialized');
    }

    try {
      // Register an event schema for wallet transaction events
      const eventSchemas = [
        {
          params: [
            { name: 'wallet', paramType: 'address', isIndexed: true },
            { name: 'transactionHash', paramType: 'bytes32', isIndexed: true },
            { name: 'value', paramType: 'uint256', isIndexed: false }
          ],
          eventTopic: 'WalletTransaction(address indexed wallet, bytes32 indexed transactionHash, uint256 value)'
        }
      ];

      // Try to register the event schema
      const result = await this.somniaSDK.streams.registerEventSchemas(
        ['WalletTransaction'],
        eventSchemas
      );

      if (result) {
        logger.info('✅ Wallet transaction event schema registered successfully');
      } else {
        logger.debug('Wallet transaction event schema may already be registered');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('⚠️  Could not register wallet transaction event schema (may already exist):', errorMessage);
      // This is not critical, we can continue without it
    }
  }

  /**
   * Fetch wallet transactions specifically for Somnia integration
   */
  private async fetchWalletTransactionsForSomnia(
    walletAddress: string,
    callback: (event: WalletEvent) => void
  ): Promise<void> {
    try {
      const provider = blockchainConfig.getProvider();

      // Get a wider historical range to catch all transactions
      const latestBlock = await provider.getBlockNumber();
      const startBlock = 1; // Start from block 1 to get full history

      // Filter for transactions to/from the wallet
      const filter = {
        address: walletAddress as `0x${string}`,
        fromBlock: `0x${startBlock.toString(16)}`,
        toBlock: `0x${latestBlock.toString(16)}`
      };

      const logs = await provider.getLogs(filter);
      logger.info(`Found ${logs.length} historical logs for wallet ${walletAddress} in blocks ${startBlock} to ${latestBlock}`);

      // Process each log to create wallet events
      for (const log of logs) {
        try {
          // Get the full transaction
          const tx = await provider.getTransaction(log.transactionHash as `0x${string}`);
          if (!tx) continue;

          // Get transaction receipt for status and gas info
          const receipt = await provider.getTransactionReceipt(log.transactionHash as `0x${string}`);
          if (!receipt) continue;

          // Get the block to get timestamp
          const block = await provider.getBlock(tx.blockNumber!);

          // Create a WalletEvent from the transaction
          const event: WalletEvent = {
            type: tx.to && (await provider.getCode(tx.to)).length > 2 ? 'contract_interaction' : 'transaction',
            hash: tx.hash,
            from: tx.from?.toLowerCase() || walletAddress,
            to: tx.to?.toLowerCase() || walletAddress,
            value: tx.value?.toString() || '0',
            blockNumber: tx.blockNumber || 0,
            timestamp: (block?.timestamp || Date.now()) * 1000, // Convert to milliseconds
            gasPrice: tx.gasPrice?.toString() || '0',
            gasUsed: receipt.gasUsed?.toString() || '0',
            status: receipt.status === 1 ? 'success' : 'failed',
            input: tx.data || '0x',
            contractAddress: tx.to?.toLowerCase() || '',
            tokenSymbol: 'SOMNIA',
            tokenValue: tx.value?.toString() || '0',
            methodId: tx.data?.substring(0, 10) || '0x',
            nonce: tx.nonce || 0,
            position: (log.index !== undefined && log.index !== null) ? Number(log.index) : 0
          };

          // Only trigger callback if this transaction involves our wallet as sender or receiver
          if (event.from.toLowerCase() === walletAddress.toLowerCase() ||
              event.to.toLowerCase() === walletAddress.toLowerCase()) {
            callback(event);
            logger.debug(`Historical transaction processed for ${walletAddress}:`, {
              hash: tx.hash,
              from: event.from,
              to: event.to,
              value: event.value,
              status: event.status
            });
          }
        } catch (txError: unknown) {
          const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
          logger.warn(`Could not process transaction ${log.transactionHash} for wallet ${walletAddress}:`, errorMessage);
          continue;
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching wallet transactions for Somnia:', errorMessage);
    }
  }

  /**
   * Process data received from Somnia SDK and convert to WalletEvent format
   */
  private async processSomniaData(data: any, walletAddress: string): Promise<WalletEvent[]> {
    const events: WalletEvent[] = [];

    try {
      logger.debug('Processing Somnia data:', data);

      // The data format depends on how the subscription was set up
      // Based on the Somnia documentation, process the received data
      if (data && Array.isArray(data)) {
        // Process array of transactions/data
        for (const item of data) {
          const event = await this.createWalletEventFromData(item, walletAddress);
          if (event) {
            events.push(event);
          }
        }
      } else if (data && typeof data === 'object') {
        // Process single data object
        if (data.logs && Array.isArray(data.logs)) {
          // Process transaction logs
          for (const log of data.logs) {
            const event = await this.createWalletEventFromLog(log, walletAddress);
            if (event) {
              events.push(event);
            }
          }
        } else if (data.transactionHash) {
          // Single transaction received
          const event = await this.createWalletEventFromData(data, walletAddress);
          if (event) {
            events.push(event);
          }
        } else {
          // Try to process as generic data
          const event = await this.createWalletEventFromData(data, walletAddress);
          if (event) {
            events.push(event);
          }
        }
      }

      logger.info(`✅ Processed ${events.length} events from Somnia data for wallet ${walletAddress}`);
      return events;
    } catch (error) {
      logger.error('Error processing Somnia data:', error);
      return events; // Return empty array on error
    }
  }

  /**
   * Create a WalletEvent from transaction data
   */
  private async createWalletEventFromData(data: any, walletAddress: string): Promise<WalletEvent | null> {
    try {
      // Get provider for additional info if needed
      const provider = blockchainConfig.getProvider();

      // Create event based on available data
      const event: WalletEvent = {
        type: data.type || 'transaction',
        hash: data.hash || data.transactionHash || `0x${Math.random().toString(16).substr(2, 64)}`,
        from: (data.from || data.fromAddress || '').toLowerCase(),
        to: (data.to || data.toAddress || '').toLowerCase(),
        value: data.value?.toString() || data.amount?.toString() || '0',
        blockNumber: data.blockNumber || 0,
        timestamp: data.timestamp ? (typeof data.timestamp === 'number' ? data.timestamp * 1000 : data.timestamp) : Date.now(),
        gasPrice: data.gasPrice?.toString() || '0',
        gasUsed: data.gasUsed?.toString() || '0',
        status: data.status || data.success ? (data.success ? 'success' : 'failed') : 'success',
        input: data.input || data.data || '0x',
        contractAddress: (data.contractAddress || '').toLowerCase(),
        tokenSymbol: data.tokenSymbol || 'SOMNIA',
        tokenValue: data.tokenValue?.toString() || data.value?.toString() || '0',
        methodId: data.methodId || data.input?.substring(0, 10) || '0x',
        nonce: data.nonce || 0,
        position: data.position || data.logIndex || 0
      };

      // Ensure that the transaction involves our wallet
      if (!event.from || !event.to) {
        // If from/to aren't clear, try to identify the wallet involvement
        // This could be a special case where we need to get more details from the blockchain
        if (event.contractAddress && event.contractAddress.toLowerCase() === walletAddress.toLowerCase()) {
          event.from = walletAddress;
          event.to = walletAddress;
        } else {
          // If it's not clearly related to our wallet, we might need to skip it
          logger.debug(`Transaction does not clearly involve wallet ${walletAddress}, skipping:`, event.hash);
          return null;
        }
      }

      return event;
    } catch (error) {
      logger.error('Error creating wallet event from data:', error);
      return null;
    }
  }

  /**
   * Create a WalletEvent from a log entry
   */
  private async createWalletEventFromLog(log: any, walletAddress: string): Promise<WalletEvent | null> {
    try {
      const provider = blockchainConfig.getProvider();

      // Get the full transaction details if we only have a log
      let txHash = log.transactionHash;
      if (!txHash && log.txHash) txHash = log.txHash;

      if (txHash) {
        const tx = await provider.getTransaction(txHash as `0x${string}`);
        if (tx) {
          const receipt = await provider.getTransactionReceipt(txHash as `0x${string}`);
          const block = tx.blockNumber ? await provider.getBlock(tx.blockNumber) : null;

          const event: WalletEvent = {
            type: 'transaction',
            hash: tx.hash,
            from: tx.from?.toLowerCase() || walletAddress,
            to: tx.to?.toLowerCase() || walletAddress,
            value: tx.value?.toString() || '0',
            blockNumber: tx.blockNumber || 0,
            timestamp: (block?.timestamp || Date.now()) * 1000,
            gasPrice: tx.gasPrice?.toString() || '0',
            gasUsed: receipt?.gasUsed?.toString() || '0',
            status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'success',
            input: tx.data || '0x',
            contractAddress: receipt?.contractAddress?.toLowerCase() || '',
            tokenSymbol: 'SOMNIA',
            tokenValue: tx.value?.toString() || '0',
            methodId: tx.data?.substring(0, 10) || '0x',
            nonce: tx.nonce || 0,
            position: (log.index !== undefined && log.index !== null) ? Number(log.index) : 0
          };

          // Only return if this transaction involves our wallet
          if (event.from.toLowerCase() === walletAddress.toLowerCase() ||
              (event.to && event.to.toLowerCase() === walletAddress.toLowerCase())) {
            return event;
          }
        }
      }

      // If we couldn't get transaction details, create a minimal event
      return {
        type: 'transaction',
        hash: log.transactionHash || `0x${Math.random().toString(16).substr(2, 64)}`,
        from: walletAddress,
        to: walletAddress,
        value: '0',
        blockNumber: log.blockNumber || 0,
        timestamp: Date.now(),
        gasPrice: '0',
        gasUsed: '0',
        status: 'success',
        input: '0x',
        contractAddress: log.address?.toLowerCase() || '',
        tokenSymbol: 'SOMNIA',
        tokenValue: '0',
        methodId: '0x',
        nonce: 0,
        position: (log.logIndex !== undefined && log.logIndex !== null) ? Number(log.logIndex) : 0
      };
    } catch (error) {
      logger.error('Error creating wallet event from log:', error);
      return null;
    }
  }

  /**
   * Fallback method to use provider polling when SDK is not available
   */
  private async setupProviderPolling(
    walletAddress: string,
    callback: (event: WalletEvent) => void,
    config?: Partial<WalletMonitoringConfig>
  ): Promise<void> {
    // Get provider from blockchain config to monitor wallet
    const provider = blockchainConfig.getProvider();
    let lastBlockChecked = await provider.getBlockNumber();

    // Keep track of the last known transaction count to detect new transactions
    let lastTxCount = await provider.getTransactionCount(walletAddress as `0x${string}`);

    // Track transaction hashes to detect new transactions
    const processedTxCache = new Set<string>(); // Global cache for this wallet
    const recentTxHashSet = new Set<string>(); // Local cache for this polling session

    // Poll for new transactions for this wallet with comprehensive detection logic
    const pollInterval = setInterval(async () => {
      try {
        // Get latest block number and transaction count
        const latestBlock = await provider.getBlockNumber();

        // Approach: Search for transactions in a wider block range to catch all activities
        const recentBlockRange = 20; // Check more blocks to catch recent transactions
        const recentFromBlock = Math.max(1, latestBlock - recentBlockRange);

        logger.debug(`Scanning blocks ${recentFromBlock} to ${latestBlock} for wallet ${walletAddress}`);

        // Create filters for both incoming and outgoing transactions
        const filter = {
          address: walletAddress as `0x${string}`,
          fromBlock: `0x${recentFromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`
        };

        let transactionCount = 0;

        try {
          // Get logs that involve our wallet address
          const logs = await provider.getLogs(filter);

          logger.debug(`Found ${logs.length} logs for wallet ${walletAddress} in blocks ${recentFromBlock} to ${latestBlock}`);

          // Process each log to extract transaction details
          for (const log of logs) {
            const txHash = log.transactionHash;

            if (!txHash || recentTxHashSet.has(txHash) || processedTxCache.has(txHash)) {
              continue; // Skip if already processed
            }

            try {
              // Get the full transaction details
              const tx = await provider.getTransaction(txHash as `0x${string}`);
              if (!tx) continue;

              // Get the receipt to determine status and gas info
              const receipt = await provider.getTransactionReceipt(txHash as `0x${string}`);
              if (!receipt) {
                // If no receipt yet, it might be pending - try again later
                continue;
              }

              // Get the block for timestamp
              const block = tx.blockNumber ? await provider.getBlock(tx.blockNumber) : null;

              // Create WalletEvent from the transaction data
              const event: WalletEvent = {
                type: tx.to && (await provider.getCode(tx.to)).length > 2 ? 'contract_interaction' : 'transaction',
                hash: tx.hash,
                from: tx.from?.toLowerCase() || walletAddress,
                to: tx.to?.toLowerCase() || walletAddress,
                value: tx.value?.toString() || '0',
                blockNumber: tx.blockNumber || 0,
                timestamp: (block?.timestamp || Math.floor(Date.now() / 1000)) * 1000,
                gasPrice: tx.gasPrice?.toString() || '0',
                gasUsed: receipt.gasUsed?.toString() || '0',
                status: receipt.status === 1 ? 'success' : 'failed',
                input: tx.data || '0x',
                contractAddress: receipt.contractAddress?.toLowerCase() || '',
                tokenSymbol: 'SOMNIA',
                tokenValue: tx.value?.toString() || '0',
                methodId: tx.data?.substring(0, 10) || '0x',
                nonce: tx.nonce || 0,
                position: receipt.index || 0
              };

              // Only trigger callback if this transaction involves our wallet as sender or receiver
              if (event.from.toLowerCase() === walletAddress.toLowerCase() ||
                  event.to.toLowerCase() === walletAddress.toLowerCase()) {

                callback(event);
                recentTxHashSet.add(txHash);
                processedTxCache.add(txHash);
                this.markTxProcessed(txHash);
                transactionCount++;

                logger.info(`✅ Transaction detected for ${walletAddress}:`, {
                  hash: tx.hash,
                  from: event.from,
                  to: event.to,
                  value: event.value,
                  blockNumber: event.blockNumber,
                  status: event.status
                });
              }
            } catch (txError: any) {
              logger.warn(`Could not process transaction ${log.transactionHash} for wallet ${walletAddress}:`, txError.message);
              continue;
            }
          }
        } catch (logsError) {
          logger.error('Error fetching logs for wallet:', logsError);
          // If logs fetching fails, fall back to checking each block individually
          for (let blockNum = recentFromBlock; blockNum <= latestBlock; blockNum++) {
            try {
              const block = await provider.getBlock(blockNum, true);
              if (!block || !block.transactions) continue;

              // Process each transaction in the block
              for (const txHash of block.transactions) {
                if (!txHash) continue;

                if (!recentTxHashSet.has(txHash) && !processedTxCache.has(txHash)) {
                  // Get the full transaction details
                  const tx = await provider.getTransaction(txHash as `0x${string}`);
                  if (!tx) continue;

                  // Check if transaction involves our wallet (either as sender or receiver)
                  const involvesWallet =
                    (tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase()) ||
                    (tx.to && tx.to && tx.to.toLowerCase() === walletAddress.toLowerCase());

                  if (involvesWallet) {
                    try {
                      // Get the transaction receipt to determine status
                      const receipt = await provider.getTransactionReceipt(txHash as `0x${string}`);

                      // Create a real WalletEvent from the transaction data
                      const realEvent: WalletEvent = {
                        type: tx.to && (await provider.getCode(tx.to)).length > 2 ? 'contract_interaction' : 'transaction',
                        hash: tx.hash,
                        from: tx.from?.toLowerCase() || '0x0000000000000000000000000000000000000000',
                        to: tx.to?.toLowerCase() || '0x0000000000000000000000000000000000000000',
                        value: tx.value?.toString() || '0',
                        blockNumber: tx.blockNumber || blockNum,
                        timestamp: (block.timestamp || Math.floor(Date.now() / 1000)) * 1000,
                        gasPrice: tx.gasPrice?.toString() || '0',
                        gasUsed: receipt?.gasUsed?.toString() || '0',
                        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'success',
                        input: tx.data || '0x',
                        contractAddress: tx.to?.toLowerCase() || '',
                        tokenSymbol: 'SOMNIA',
                        tokenValue: tx.value?.toString() || '0',
                        methodId: tx.data?.substring(0, 10) || '0x',
                        nonce: tx.nonce || 0,
                        position: receipt?.index || 0
                      };

                      callback(realEvent);
                      recentTxHashSet.add(txHash);
                      processedTxCache.add(txHash);
                      this.markTxProcessed(txHash);
                      transactionCount++;

                      logger.info(`Transaction found for ${walletAddress} in block ${blockNum}: ${tx.hash.substring(0, 10)}...`, {
                        value: realEvent.value,
                        from: realEvent.from,
                        to: realEvent.to,
                        status: realEvent.status
                      });
                    } catch (receiptError: any) {
                      logger.warn(`Could not fetch receipt for transaction ${txHash}:`, receiptError.message);
                      continue;
                    }
                  }
                }
              }
            } catch (blockError: any) {
              logger.debug(`Could not fetch block ${blockNum} with details:`, blockError.message);
              continue; // Continue with other blocks
            }
          }
        }

        // Update tracking variables
        lastTxCount = await provider.getTransactionCount(walletAddress as `0x${string}`); // Update with the latest transaction count
        lastBlockChecked = latestBlock; // Update the last processed block

        if (transactionCount > 0) {
          logger.info(`✅ ${transactionCount} transactions processed for ${walletAddress}`);
        } else {
          logger.debug(`No new transactions found for ${walletAddress} in blocks ${recentFromBlock}-${latestBlock} (tx count: ${lastTxCount})`);
        }

        // Clean up local cache periodically to prevent memory leaks
        if (recentTxHashSet.size > 1000) { // Increase cache size to handle more transactions
          // Keep only recent transactions (last 500)
          const entries = Array.from(recentTxHashSet);
          for (let i = 0; i < entries.length - 500; i++) {
            recentTxHashSet.delete(entries[i]);
          }
        }

      } catch (error: any) {
        logger.error('Error in polling for wallet events:', error);
        // Don't let a single error stop the polling
        if (error.message && (error.message.includes('timeout') || error.message.includes('network'))) {
          logger.warn('Network timeout detected, continuing...');
        } else {
          logger.error('Polling error (will continue):', error.message || error);
        }
      }
    }, 2000); // Poll every 2 seconds for faster detection

    // Store interval ID as a subscription object
    const realSubscription = {
      unsubscribe: () => clearInterval(pollInterval)
    };

    this.activeSubscriptions.set(walletAddress, realSubscription);
  }

  /**
   * Track processed transactions to avoid duplicates
   */
  private processedTransactions = new Set<string>();

  private hasProcessedTx(txHash: string): boolean {
    return this.processedTransactions.has(txHash);
  }

  private markTxProcessed(txHash: string): void {
    this.processedTransactions.add(txHash);
    // Clean up old entries periodically to prevent memory issues
    if (this.processedTransactions.size > 10000) {
      // For a more sophisticated cleanup, we could use a time-based approach
      const entries = Array.from(this.processedTransactions.entries());
      for (let i = 0; i < 1000; i++) { // Remove oldest 1000 entries
        if (entries[i]) {
          this.processedTransactions.delete(entries[i][0]);
        }
      }
    }
  }

  /**
   * Unsubscribe from wallet events
   */
  public async unsubscribeFromWallet(walletAddress: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Somnia service not connected');
    }

    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) {
      throw new Error(`Invalid wallet address: ${validation.errors.join(', ')}`);
    }

    const normalizedAddress = validation.normalized!;

    // Get the subscription to unsubscribe
    const subscription = this.activeSubscriptions.get(normalizedAddress);
    if (subscription) {
      try {
        if (typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        } else {
          logger.warn('Subscription object does not have unsubscribe method', { wallet: normalizedAddress });
        }
        logger.info('✅ Unsubscribed from wallet events', {
          wallet: normalizedAddress
        });
      } catch (error) {
        logger.error('Error unsubscribing from wallet:', error, { wallet: normalizedAddress });
      } finally {
        // Clean up tracking regardless of success/failure
        this.activeSubscriptions.delete(normalizedAddress);
        this.subscribedWallets.delete(normalizedAddress);
        this.eventCallbacks.delete(normalizedAddress);
      }
    } else {
      logger.warn('No active subscription found for wallet:', normalizedAddress);
      // Still remove from tracking if previously subscribed
      this.subscribedWallets.delete(normalizedAddress);
      this.eventCallbacks.delete(normalizedAddress);
    }
  }

  /**
   * Subscribe to block events
   */
  public async subscribeToBlocks(callback: (block: any) => void): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Somnia service not connected');
    }

    try {
      logger.debug('Subscribing to block events');

      // For now, block subscription would be handled differently
      // For demo mode, just store the callback for simulated block monitoring
      const callbackId = Helpers.generateUniqueId('block');
      this.blockCallbacks.set(callbackId, callback);

      // In a real implementation, you'd monitor for new blocks
      // This could be implemented with blockchain provider polling or WebSocket connection

      logger.debug('✅ Subscribed to block events');

    } catch (error) {
      logger.error('❌ Failed to subscribe to blocks:', error);
      throw new Error(`Failed to subscribe to blocks: ${error}`);
    }
  }



  /**
   * Handle incoming block events
   */
  private handleBlockEvent(blockEvent: any): void {
    try {
      const blockData: BlockData = {
        number: blockEvent.number || 0,
        hash: blockEvent.hash || '',
        timestamp: blockEvent.timestamp || Date.now(),
        parentHash: blockEvent.parentHash || '',
        miner: blockEvent.miner || '',
        difficulty: blockEvent.difficulty || '0',
        totalDifficulty: blockEvent.totalDifficulty || '0',
        size: blockEvent.size || 0,
        gasUsed: blockEvent.gasUsed || '0',
        gasLimit: blockEvent.gasLimit || '0',
        baseFeePerGas: blockEvent.baseFeePerGas || '0',
        transactions: blockEvent.transactions || []
      };

      // Notify all block callbacks
      this.blockCallbacks.forEach((callback, id) => {
        try {
          callback(blockData);
        } catch (error) {
          logger.error(`Error in block callback ${id}:`, error);
        }
      });

      logger.debug('Processed block event', {
        blockNumber: blockData.number,
        transactionCount: blockData.transactions.length
      });

    } catch (error) {
      logger.error('Error processing block event:', error, {
        event: blockEvent
      });
    }
  }



  /**
   * Handle reconnection logic
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;

    logger.info(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    await Helpers.delay(this.RECONNECT_DELAY);

    try {
      await this.connectToSomnia();
    } catch (error) {
      logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      
      // Schedule next reconnection attempt
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => this.handleReconnection(), this.RECONNECT_DELAY);
      }
    }
  }

  /**
   * Resubscribe to previously subscribed wallets after reconnection
   */
  private async resubscribeToWallets(): Promise<void> {
    if (this.subscribedWallets.size === 0) return;

    logger.info(`🔄 Resubscribing to ${this.subscribedWallets.size} wallets...`);

    const wallets = Array.from(this.subscribedWallets);
    let successCount = 0;

    for (const wallet of wallets) {
      try {
        const callback = this.eventCallbacks.get(wallet);
        if (callback) {
          await this.subscribeToWallet(wallet, callback);
          successCount++;
        }
      } catch (error) {
        logger.error(`Failed to resubscribe to wallet ${wallet}:`, error);
      }
    }

    logger.info(`✅ Resubscribed to ${successCount}/${wallets.length} wallets`);
  }

  /**
   * Get subscription status
   */
  public getSubscriptionStatus(): {
    connected: boolean;
    subscribedWallets: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      subscribedWallets: this.subscribedWallets.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Get list of subscribed wallets
   */
  public getSubscribedWallets(): string[] {
    return Array.from(this.subscribedWallets);
  }

  /**
   * Check if wallet is subscribed
   */
  public isWalletSubscribed(walletAddress: string): boolean {
    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) return false;
    
    return this.subscribedWallets.has(validation.normalized!);
  }

  /**
   * Publish wallet risk score to Somnia data stream
   */
  public async publishScoreToStream(
    walletAddress: string,
    score: number,
    riskLevel: string,
    timestamp?: number
  ): Promise<string | null> {
    if (!this.somniaSDK) {
      throw new Error('Somnia SDK not initialized');
    }

    try {
      // First, ensure the transaction schema is registered
      await this.registerTransactionSchema();

      // Define the risk score schema
      const riskScoreSchema = `uint64 timestamp, address wallet, uint8 score, string riskLevel, uint64 reputationScore`;
      const schemaIdRaw = await this.somniaSDK.streams.computeSchemaId(riskScoreSchema);
      if (!schemaIdRaw) {
        throw new Error('Failed to compute schema ID for risk score schema');
      }
      const schemaId: `0x${string}` = schemaIdRaw;

      // Register the risk score schema if not already registered
      const isRegistered = await this.somniaSDK.streams.isDataSchemaRegistered(schemaId);
      if (!isRegistered) {
        const registrationResult = await this.somniaSDK.streams.registerDataSchemas([
          {
            id: toHex("risk_score", { size: 32 }),
            schema: riskScoreSchema,
            parentSchemaId: zeroBytes32 // Use the imported constant
          } as any
        ]);

        if (!registrationResult) {
          logger.warn('⚠️  Risk score schema registration may have failed');
        }
      }

      // Encode the data using SchemaEncoder
      const { SchemaEncoder } = await import('@somnia-chain/streams');
      const schemaEncoder = new SchemaEncoder(riskScoreSchema);

      const encodedData = schemaEncoder.encodeData([
        { name: "timestamp", value: (timestamp || Date.now()).toString(), type: "uint64" },
        { name: "wallet", value: walletAddress, type: "address" },
        { name: "score", value: Math.round(score).toString(), type: "uint8" },
        { name: "riskLevel", value: riskLevel, type: "string" },
        { name: "reputationScore", value: Math.round(score).toString(), type: "uint64" }
      ]);

      // Create the data stream object - need a proper hex string id
      const dataId = toHex(`${walletAddress}-${Date.now()}`, { size: 32 });

      const dataStream = {
        id: dataId,
        schemaId: schemaId,
        data: encodedData
      };

      // Publish the score to the stream
      const txHash = await this.somniaSDK.streams.set([dataStream]);

      logger.info(`✅ Published risk score to stream for wallet ${walletAddress}`, {
        txHash,
        wallet: walletAddress,
        score,
        riskLevel
      });

      return txHash;

    } catch (error) {
      logger.error('Failed to publish score to Somnia stream:', error);
      return null;
    }
  }

  /**
   * Health check for Somnia service
   */
  public healthCheck(): {
    healthy: boolean;
    details: {
      connected: boolean;
      subscribedWallets: number;
      reconnectAttempts: number;
      eventCallbacks: number;
      blockCallbacks: number;
      demoMode: boolean;
    };
  } {
    return {
      healthy: this.isConnected,
      details: {
        connected: this.isConnected,
        subscribedWallets: this.subscribedWallets.size,
        reconnectAttempts: this.reconnectAttempts,
        eventCallbacks: this.eventCallbacks.size,
        blockCallbacks: this.blockCallbacks.size,
        demoMode: this.isDemoMode
      }
    };
  }

  /**
   * Disconnect from Somnia streams
   */
  public async disconnect(): Promise<void> {
    try {
      // Unsubscribe from all active subscriptions
      for (const [wallet, subscription] of this.activeSubscriptions) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          logger.warn('Error unsubscribing from wallet:', { wallet, error });
        }
      }

      // Clear all subscriptions
      this.activeSubscriptions.clear();
      this.subscribedWallets.clear();
      this.eventCallbacks.clear();
      this.blockCallbacks.clear();

      // Clean up SDK if initialized
      if (this.somniaSDK) {
        this.somniaSDK = null;
        logger.info('✅ Somnia SDK disconnected');
      }

      this.isConnected = false;

      logger.info('✅ Disconnected from Somnia streams');

    } catch (error) {
      logger.error('Error disconnecting from Somnia streams:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.disconnect();
    logger.debug('Somnia service cleanup completed');
  }
}

// Mock DataStreamClient implementation for development purposes


// Export singleton instance
export const somniaService = SomniaService.getInstance();

// Legacy export for backward compatibility
export const connectToSomnia = () => somniaService.connectToSomnia();
export const subscribeToWallet = (wallet: string, callback: (event: WalletEvent) => void) => 
  somniaService.subscribeToWallet(wallet, callback);
export const unsubscribeFromWallet = (wallet: string) => 
  somniaService.unsubscribeFromWallet(wallet);