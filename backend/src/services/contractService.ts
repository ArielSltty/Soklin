/**
 * Smart Contract Interaction Service
 * Handles all interactions with the WalletFlagger smart contract
 */

import { ethers, ContractTransactionResponse, TransactionReceipt } from 'ethers';
import { logger } from '../config/logging';
import { blockchainConfig } from '../config/blockchain';
import { Helpers } from '../utils/helpers';
import { Validators } from '../utils/validators';
import {
  ContractConfig,
  WalletFlag,
  ContractEvent,
  GasEstimate,
  TransactionReceipt as CustomReceipt
} from '../models/ContractInteraction';
import { RiskLevel } from '../models/ScoringResult';

export class ContractService {
  private static instance: ContractService;
  private contract: ethers.Contract | null = null;
  private isInitialized: boolean = false;
  private readonly GAS_LIMIT = 500000;
  private readonly CONFIRMATIONS = 2;

  // Event listeners
  private eventListeners: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): ContractService {
    if (!ContractService.instance) {
      ContractService.instance = new ContractService();
    }
    return ContractService.instance;
  }

  /**
   * Initialize contract service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Contract service already initialized');
      return;
    }

    try {
      logger.info('🔄 Initializing contract service...');

      // Initialize blockchain config first
      await blockchainConfig.initialize();

      // Get contract instance
      this.contract = blockchainConfig.getContract();

      // Verify contract is accessible
      await this.verifyContract();

      this.isInitialized = true;
      logger.info('✅ Contract service initialized successfully', {
        contractAddress: this.contract.target,
        network: await this.getNetworkInfo()
      });

    } catch (error) {
      logger.error('❌ Failed to initialize contract service:', error);
      throw error;
    }
  }

  /**
   * Verify contract is accessible and has correct interface
   */
  private async verifyContract(): Promise<void> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      // Test basic contract call
      const count = await this.contract.getActiveFlaggedCount();
      logger.debug('✅ Contract verification successful', { activeFlaggedCount: count });

    } catch (error) {
      logger.error('❌ Contract verification failed:', error);
      throw new Error('Contract interface mismatch or inaccessible');
    }
  }

  /**
   * Flag a wallet on-chain
   */
  public async flagWallet(
    walletAddress: string,
    riskLevel: RiskLevel,
    reputationScore: number,
    reason: string = 'Suspicious activity detected'
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    receipt?: CustomReceipt;
    error?: string;
  }> {
    try {
      // Validate inputs
      this.validateFlaggingInputs(walletAddress, riskLevel, reputationScore, reason);

      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      logger.info(`🚩 Flagging wallet on-chain: ${walletAddress}`, {
        riskLevel,
        reputationScore,
        reason
      });

      // Convert risk level to contract enum (0-3)
      const riskLevelValue = this.riskLevelToContractValue(riskLevel);

      // Execute contract call with proper parameters for flagWallet function
      const transaction = await this.contract.flagWallet(
        walletAddress,
        riskLevelValue,
        reputationScore,
        reason,
        { gasLimit: this.GAS_LIMIT }
      );

      logger.info('📝 Transaction submitted', {
        hash: transaction.hash,
        wallet: walletAddress,
        gasLimit: this.GAS_LIMIT
      });

      // Wait for confirmation
      const receipt = await transaction.wait(this.CONFIRMATIONS);

      if (receipt && receipt.status === 1) {
        logger.info('✅ Wallet flagged successfully', {
          hash: transaction.hash,
          wallet: walletAddress,
          blockNumber: receipt.blockNumber
        });

        return {
          success: true,
          transactionHash: transaction.hash,
          receipt: this.formatReceipt(receipt)
        };
      } else {
        logger.error('❌ Transaction failed', {
          hash: transaction.hash,
          wallet: walletAddress
        });

        return {
          success: false,
          transactionHash: transaction.hash,
          error: 'Transaction reverted'
        };
      }

    } catch (error) {
      logger.error('❌ Failed to flag wallet:', error);
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Unflag a wallet
   */
  public async unflagWallet(walletAddress: string): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      Validators.isValidEthereumAddress(walletAddress);

      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      logger.info(`🔓 Unflagging wallet: ${walletAddress}`);

      const transaction = await this.contract.unflagWallet(
        walletAddress,
        { gasLimit: this.GAS_LIMIT }
      );

      const receipt = await transaction.wait(this.CONFIRMATIONS);

      if (receipt && receipt.status === 1) {
        logger.info('✅ Wallet unflagged successfully', {
          hash: transaction.hash,
          wallet: walletAddress
        });

        return {
          success: true,
          transactionHash: transaction.hash
        };
      } else {
        return {
          success: false,
          transactionHash: transaction.hash,
          error: 'Transaction reverted'
        };
      }

    } catch (error) {
      logger.error('❌ Failed to unflag wallet:', error);
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Update wallet risk level
   */
  public async updateRiskLevel(
    walletAddress: string,
    riskLevel: RiskLevel
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      Validators.isValidEthereumAddress(walletAddress);

      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const riskLevelValue = this.riskLevelToContractValue(riskLevel);

      logger.info(`🔄 Updating risk level for wallet: ${walletAddress}`, {
        riskLevel,
        riskLevelValue
      });

      const transaction = await this.contract.updateRiskLevel(
        walletAddress,
        riskLevelValue,
        { gasLimit: this.GAS_LIMIT }
      );

      const receipt = await transaction.wait(this.CONFIRMATIONS);

      if (receipt && receipt.status === 1) {
        logger.info('✅ Risk level updated successfully', {
          hash: transaction.hash,
          wallet: walletAddress,
          riskLevel
        });

        return {
          success: true,
          transactionHash: transaction.hash
        };
      } else {
        return {
          success: false,
          transactionHash: transaction.hash,
          error: 'Transaction reverted'
        };
      }

    } catch (error) {
      logger.error('❌ Failed to update risk level:', error);
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Check if wallet is flagged
   */
  public async isWalletFlagged(walletAddress: string): Promise<boolean> {
    try {
      Validators.isValidEthereumAddress(walletAddress);

      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const isFlagged = await this.contract.isWalletFlagged(walletAddress);
      
      logger.debug('Checked wallet flag status', {
        wallet: walletAddress,
        isFlagged
      });

      return isFlagged;

    } catch (error) {
      logger.error('Error checking wallet flag status:', error);
      throw new Error(`Failed to check wallet flag: ${error}`);
    }
  }

  /**
   * Get detailed wallet flag information
   */
  public async getWalletFlag(walletAddress: string): Promise<WalletFlag | null> {
    try {
      Validators.isValidEthereumAddress(walletAddress);

      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const flagData = await this.contract.getWalletFlag(walletAddress);

      // Check if wallet is actually flagged
      if (!flagData.isFlagged) {
        return null;
      }

      const walletFlag: WalletFlag = {
        wallet: walletAddress,
        isFlagged: flagData.isFlagged,
        riskLevel: this.contractValueToRiskLevel(Number(flagData.riskLevel)),
        reputationScore: Number(flagData.reputationScore),
        flaggedAt: Number(flagData.flaggedAt),
        expiresAt: Number(flagData.expiresAt),
        flaggedBy: flagData.flaggedBy,
        reason: flagData.reason,
        transactionHash: flagData.transactionHash
      };

      return walletFlag;

    } catch (error) {
      logger.error('Error getting wallet flag details:', error);
      throw new Error(`Failed to get wallet flag: ${error}`);
    }
  }

  /**
   * Get all flagged wallets
   */
  public async getAllFlaggedWallets(): Promise<string[]> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const flaggedWallets = await this.contract.getAllFlaggedWallets();
      return flaggedWallets;

    } catch (error) {
      logger.error('Error getting all flagged wallets:', error);
      throw new Error(`Failed to get flagged wallets: ${error}`);
    }
  }

  /**
   * Get count of active flagged wallets
   */
  public async getActiveFlaggedCount(): Promise<number> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const count = await this.contract.getActiveFlaggedCount();
      return Number(count);

    } catch (error) {
      logger.error('Error getting active flagged count:', error);
      throw new Error(`Failed to get active flagged count: ${error}`);
    }
  }

  /**
   * Estimate gas for flagWallet operation
   */
  public async estimateFlagWalletGas(
    walletAddress: string,
    riskLevel: number,
    reputationScore: number,
    reason: string
  ): Promise<GasEstimate> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const gasEstimate = await blockchainConfig.getGasEstimate(
        this.contract.target as string,
        this.contract.interface.encodeFunctionData('flagWallet', [
          walletAddress,
          riskLevel,
          reputationScore,
          reason
        ])
      );

      return {
        gasLimit: Number(gasEstimate.gasLimit),
        gasPrice: gasEstimate.gasPrice?.toString() || '0',
        maxFeePerGas: gasEstimate.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas?.toString(),
        estimatedCost: gasEstimate.estimatedCost
      };

    } catch (error) {
      logger.warn('Gas estimation failed, using default:', error);
      return {
        gasLimit: this.GAS_LIMIT,
        gasPrice: '0',
        estimatedCost: '0'
      };
    }
  }

  /**
   * Listen for contract events
   */
  public async listenForEvents(
    eventName: string,
    callback: (event: ContractEvent) => void
  ): Promise<void> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const eventFilter = this.contract.filters[eventName]();
      const listener = (...args: any[]) => {
        const event = args[args.length - 1] as ethers.EventLog;
        
        const contractEvent: ContractEvent = {
          event: eventName as any,
          address: event.address,
          returnValues: event.args,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.index
        };

        callback(contractEvent);
      };

      this.contract.on(eventFilter, listener);
      this.eventListeners.set(eventName, listener);

      logger.debug(`Started listening for event: ${eventName}`);

    } catch (error) {
      logger.error(`Failed to listen for event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Stop listening for events
   */
  public stopListeningForEvents(eventName: string): void {
    try {
      if (!this.contract) {
        return;
      }

      const listener = this.eventListeners.get(eventName);
      if (listener) {
        this.contract.off(eventName, listener);
        this.eventListeners.delete(eventName);
        logger.debug(`Stopped listening for event: ${eventName}`);
      }

    } catch (error) {
      logger.error(`Failed to stop listening for event ${eventName}:`, error);
    }
  }

  /**
   * Get network information
   */
  public async getNetworkInfo(): Promise<{
    chainId: number;
    name: string;
    blockNumber: number;
    contractAddress: string;
  }> {
    const networkConfig = await blockchainConfig.getNetworkConfig();
    
    return {
      chainId: networkConfig.chainId,
      name: networkConfig.name,
      blockNumber: networkConfig.blockNumber,
      contractAddress: this.contract?.target as string || ''
    };
  }

  /**
   * Health check for contract service
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      contractConnected: boolean;
      networkAccessible: boolean;
      signerAvailable: boolean;
      lastBlock: number;
      flaggedWallets: number;
    };
  }> {
    try {
      const networkInfo = await this.getNetworkInfo();
      const flaggedCount = await this.getActiveFlaggedCount();

      return {
        healthy: this.isInitialized,
        details: {
          contractConnected: !!this.contract,
          networkAccessible: true,
          signerAvailable: !!blockchainConfig.getSigner(),
          lastBlock: networkInfo.blockNumber,
          flaggedWallets: flaggedCount
        }
      };

    } catch (error) {
      logger.error('Contract service health check failed:', error);
      return {
        healthy: false,
        details: {
          contractConnected: false,
          networkAccessible: false,
          signerAvailable: false,
          lastBlock: 0,
          flaggedWallets: 0
        }
      };
    }
  }

  /**
   * Validate flagging inputs
   */
  private validateFlaggingInputs(
    walletAddress: string,
    riskLevel: RiskLevel,
    reputationScore: number,
    reason: string
  ): void {
    const addressValidation = Validators.isValidEthereumAddress(walletAddress);
    if (!addressValidation.isValid) {
      throw new Error(`Invalid wallet address: ${addressValidation.errors.join(', ')}`);
    }

    if (!Validators.isValidRiskLevel(riskLevel)) {
      throw new Error('Invalid risk level');
    }

    if (!Validators.isValidScore(reputationScore)) {
      throw new Error('Invalid reputation score');
    }

    if (!reason || reason.length > 500) {
      throw new Error('Reason must be between 1 and 500 characters');
    }
  }

  /**
   * Convert RiskLevel enum to contract value
   */
  private riskLevelToContractValue(riskLevel: RiskLevel): number {
    const mapping = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 1,
      [RiskLevel.HIGH]: 2,
      [RiskLevel.CRITICAL]: 3
    };

    return mapping[riskLevel];
  }

  /**
   * Convert contract value to RiskLevel enum
   */
  private contractValueToRiskLevel(value: number): RiskLevel {
    const mapping = {
      0: RiskLevel.LOW,
      1: RiskLevel.MEDIUM,
      2: RiskLevel.HIGH,
      3: RiskLevel.CRITICAL
    };

    return mapping[value as keyof typeof mapping] || RiskLevel.MEDIUM;
  }

  /**
   * Format transaction receipt
   */
  private formatReceipt(receipt: ethers.TransactionReceipt): CustomReceipt {
    return {
      hash: receipt.hash,
      status: receipt.status === 1,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasPrice?.toString() || '0',
      contractAddress: receipt.contractAddress,
      events: receipt.logs.map(log => ({
        address: log.address,
        data: log.data,
        topics: log.topics
      }))
    };
  }

  /**
   * Format error message
   */
  private formatError(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Check if contract service is initialized
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get contract address
   */
  public getContractAddress(): string {
    return this.contract?.target as string || '';
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Remove all event listeners
    for (const [eventName] of this.eventListeners) {
      this.stopListeningForEvents(eventName);
    }

    this.eventListeners.clear();
    logger.debug('Contract service cleanup completed');
  }
}

// Export singleton instance
export const contractService = ContractService.getInstance();

// Legacy export for backward compatibility
export const initializeContract = () => contractService.initialize();