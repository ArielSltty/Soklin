/**
 * Blockchain Configuration and Setup
 * Web3 provider, contract instances, and blockchain utilities
 */

import { ethers } from 'ethers';
import { ContractConfig, WalletFlag, ContractEvent } from '../models/ContractInteraction';
import { logger } from './logging';
import { Helpers } from '../utils/helpers';
import { Validators } from '../utils/validators';

export class BlockchainConfig {
  private static instance: BlockchainConfig;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string = '';
  private isInitialized: boolean = false;

  // Contract ABI (simplified - should match your deployed contract)
  private readonly contractABI = [
    "function flagWallet(address wallet) public",
    "function unflaggedWallets(address wallet) public",
    "function updateRiskLevel(address wallet, uint8 riskLevel) public",
    "function isWalletFlagged(address wallet) public view returns (bool)",
    "function getWalletFlag(address wallet) public view returns (tuple(bool isFlagged, uint8 riskLevel, uint256 reputationScore, uint256 flaggedAt, uint256 expiresAt, address flaggedBy, string reason))",
    "function getAllFlaggedWallets() public view returns (address[])",
    "function getActiveFlaggedCount() public view returns (uint256)",
    "event WalletFlagged(address indexed wallet, uint8 riskLevel, uint256 reputationScore, uint256 expiresAt, address flaggedBy, string reason)",
    "event WalletUnflagged(address indexed wallet, address unflaggedBy)",
    "event RiskLevelUpdated(address indexed wallet, uint8 newRiskLevel)"
  ];

  private constructor() {}

  public static getInstance(): BlockchainConfig {
    if (!BlockchainConfig.instance) {
      BlockchainConfig.instance = new BlockchainConfig();
    }
    return BlockchainConfig.instance;
  }

  /**
   * Initialize blockchain connection and contract
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Blockchain config already initialized');
      return;
    }

    try {
      // Validate required environment variables
      this.validateEnvironment();

      // Initialize provider
      const rpcUrl = process.env.SOMNIA_RPC_URL;
      if (!rpcUrl) {
        throw new Error('SOMNIA_RPC_URL is required');
      }

      // Create provider with additional configuration for better reliability
      this.provider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: parseInt(process.env.SOMNIA_CHAIN_ID || '50312'),
        name: 'somnia'
      });

      // Configure additional provider settings after initialization
      // Check if _emitted exists before trying to set it
      if ((this.provider as any)._emitted !== undefined) {
        (this.provider as any)._emitted.block = -2; // Disable automatic block polling initially
      }
      (this.provider as any).pollingInterval = 4000; // Faster polling for real-time updates

      // Check connection and network details
      await this.testConnection();

      // Initialize signer if private key is provided
      if (process.env.PRIVATE_KEY) {
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        logger.info(`✅ Signer initialized: ${this.signer.address}`);
      } else {
        logger.info('ℹ️  No private key provided, running in read-only mode');
      }

      // Initialize contract if address is provided
      if (process.env.CONTRACT_ADDRESS) {
        await this.initializeContract();
      }

      this.isInitialized = true;
      logger.info('✅ Blockchain configuration initialized successfully', {
        rpcUrl: rpcUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Mask credentials
        chainId: parseInt(process.env.SOMNIA_CHAIN_ID || '50312'),
        signer: this.signer ? this.signer.address : 'read-only'
      });

    } catch (error) {
      logger.error('❌ Failed to initialize blockchain configuration:', error);
      logger.error('📋 Make sure your .env file has correct SOMNIA_RPC_URL and chain settings');
      throw error;
    }
  }

  /**
   * Initialize contract instance
   */
  private async initializeContract(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const contractAddress = process.env.CONTRACT_ADDRESS!;
    
    // Validate contract address
    const validation = Validators.isValidEthereumAddress(contractAddress);
    if (!validation.isValid) {
      throw new Error(`Invalid contract address: ${validation.errors.join(', ')}`);
    }

    this.contractAddress = validation.normalized!;

    // Create contract instance
    if (this.signer) {
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.signer
      );
    } else {
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.provider
      );
    }

    logger.info(`✅ Contract initialized at: ${this.contractAddress}`);

    // Verify contract is accessible
    try {
      const code = await this.provider.getCode(this.contractAddress);
      if (code === '0x') {
        throw new Error('No contract code at address');
      }
      logger.debug('✅ Contract code verified');
    } catch (error) {
      logger.error('❌ Contract verification failed:', error);
      throw new Error('Contract not deployed or inaccessible');
    }
  }

  /**
   * Test blockchain connection
   */
  private async testConnection(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getFeeData();

      logger.info('✅ Blockchain connection established', {
        network: {
          name: network.name,
          chainId: network.chainId,
          blockNumber
        },
        gasPrice: {
          gasPrice: gasPrice.gasPrice?.toString(),
          maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
        }
      });

    } catch (error) {
      logger.error('❌ Blockchain connection test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      throw new Error(`Cannot connect to blockchain network: ${errorMessage}`);
    }
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = ['SOMNIA_RPC_URL', 'SOMNIA_CHAIN_ID'];
    
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }

    // Validate RPC URL format
    if (!process.env.SOMNIA_RPC_URL?.startsWith('http')) {
      throw new Error('Invalid RPC URL format');
    }

    // Validate chain ID
    const chainId = parseInt(process.env.SOMNIA_CHAIN_ID || '50312');
    if (isNaN(chainId) || chainId <= 0) {
      throw new Error('Invalid chain ID');
    }

    logger.debug('✅ Environment variables validated');
  }

  /**
   * Get Web3 provider instance
   */
  public getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      throw new Error('Blockchain provider not initialized. Call initialize() first.');
    }
    return this.provider;
  }

  /**
   * Get contract instance
   */
  public getContract(): ethers.Contract {
    if (!this.contract) {
      throw new Error('Contract not initialized. Make sure CONTRACT_ADDRESS is set.');
    }
    return this.contract;
  }

  /**
   * Get signer instance
   */
  public getSigner(): ethers.Wallet | null {
    return this.signer;
  }

  /**
   * Get contract address
   */
  public getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Check if blockchain config is initialized
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get network configuration
   */
  public async getNetworkConfig(): Promise<{
    chainId: number;
    name: string;
    blockNumber: number;
    gasPrice: bigint | null;
  }> {
    const provider = this.getProvider();
    
    const [network, blockNumber, feeData] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      provider.getFeeData()
    ]);

    return {
      chainId: Number(network.chainId),
      name: network.name,
      blockNumber,
      gasPrice: feeData.gasPrice
    };
  }

  /**
   * Get gas estimates for transaction
   */
  public async getGasEstimate(
    to: string,
    data: string,
    value: bigint = BigInt(0)
  ): Promise<{
    gasLimit: bigint;
    gasPrice: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    estimatedCost: string;
  }> {
    const provider = this.getProvider();
    
    try {
      const gasLimit = await provider.estimateGas({
        to,
        data,
        value
      });

      const feeData = await provider.getFeeData();
      
      // Use EIP-1559 fees if available, otherwise legacy gas price
      const gasPrice = feeData.gasPrice || BigInt(0);
      const maxFeePerGas = feeData.maxFeePerGas;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      // Calculate estimated cost
      const cost = maxFeePerGas ? gasLimit * maxFeePerGas : gasLimit * gasPrice;
      const estimatedCost = ethers.formatEther(cost);

      return {
        gasLimit,
        gasPrice,
        maxFeePerGas: maxFeePerGas || undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
        estimatedCost
      };

    } catch (error) {
      logger.error('Gas estimation failed:', error);
      throw new Error(`Gas estimation failed: ${error}`);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  public async waitForTransaction(
    hash: string,
    confirmations: number = 1,
    timeout: number = 120000
  ): Promise<ethers.TransactionReceipt> {
    const provider = this.getProvider();
    
    try {
      const receipt = await provider.waitForTransaction(hash, confirmations, timeout);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.debug('Transaction confirmed', {
        hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString()
      });

      return receipt;

    } catch (error) {
      logger.error('Transaction confirmation failed:', error);
      throw new Error(`Transaction failed: ${error}`);
    }
  }

  /**
   * Get current gas price settings
   */
  public async getCurrentGasSettings(): Promise<{
    gasPrice: bigint | null;
    maxFeePerGas: bigint | null;
    maxPriorityFeePerGas: bigint | null;
    baseFeePerGas: bigint | null;
  }> {
    const provider = this.getProvider();
    const feeData = await provider.getFeeData();

    // Get base fee from latest block
    const latestBlock = await provider.getBlock('latest');
    const baseFeePerGas = latestBlock?.baseFeePerGas || null;

    return {
      gasPrice: feeData.gasPrice || null,
      maxFeePerGas: feeData.maxFeePerGas || null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || null,
      baseFeePerGas: baseFeePerGas || null
    };
  }

  /**
   * Check if address is a contract
   */
  public async isContract(address: string): Promise<boolean> {
    const provider = this.getProvider();
    
    try {
      const code = await provider.getCode(address);
      return code !== '0x';
    } catch (error) {
      logger.error('Error checking contract address:', error);
      return false;
    }
  }

  /**
   * Get wallet balance
   */
  public async getBalance(address: string): Promise<string> {
    const provider = this.getProvider();
    
    try {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting balance:', error);
      throw new Error(`Failed to get balance for ${address}`);
    }
  }

  /**
   * Get transaction count (nonce) for address
   */
  public async getTransactionCount(address: string): Promise<number> {
    const provider = this.getProvider();
    
    try {
      return await provider.getTransactionCount(address);
    } catch (error) {
      logger.error('Error getting transaction count:', error);
      throw new Error(`Failed to get transaction count for ${address}`);
    }
  }

  /**
   * Reset and reinitialize blockchain connection
   */
  public async reset(): Promise<void> {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.isInitialized = false;
    this.contractAddress = '';

    logger.info('🔄 Resetting blockchain configuration...');
    await this.initialize();
  }

  /**
   * Health check for blockchain connection
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      providerConnected: boolean;
      contractAccessible: boolean;
      signerAvailable: boolean;
      networkInfo?: any;
      lastBlock?: number;
    };
  }> {
    try {
      const provider = this.getProvider();
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();

      const health = {
        healthy: true,
        details: {
          providerConnected: true,
          contractAccessible: !!this.contract,
          signerAvailable: !!this.signer,
          networkInfo: {
            name: network.name,
            chainId: Number(network.chainId)
          },
          lastBlock: blockNumber
        }
      };

      // Test contract access if available
      if (this.contract) {
        try {
          await this.contract.getActiveFlaggedCount();
          health.details.contractAccessible = true;
        } catch (error) {
          health.details.contractAccessible = false;
          health.healthy = false;
        }
      }

      return health;

    } catch (error) {
      logger.error('Blockchain health check failed:', error);
      return {
        healthy: false,
        details: {
          providerConnected: false,
          contractAccessible: false,
          signerAvailable: false
        }
      };
    }
  }
}

// Export singleton instance
export const blockchainConfig = BlockchainConfig.getInstance();

// Utility exports
export {
  ethers,
  Validators as validators,
  Helpers as helpers
};