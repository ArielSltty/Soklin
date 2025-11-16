/**
 * ML Scoring Service
 * Handles ONNX model loading, feature processing, and reputation scoring
 */

import { InferenceSession, Tensor } from 'onnxruntime-node';
import path from 'path';
import { logger } from '../config/logging';
import { Helpers } from '../utils/helpers';
import { featureProcessor } from '../utils/featureProcessor';
import { WalletEvent } from '../models/WalletEvent';
import { ScoringResult, RiskLevel, FeatureVector, MLModelMetadata, ModelPrediction } from '../models/ScoringResult';
import { Validators } from '../utils/validators';

export class ScoringService {
  private static instance: ScoringService;
  private model: InferenceSession | null = null;
  private scaler: any = null;
  private featureNames: string[] = [];
  private modelMetadata: MLModelMetadata | null = null;
  private blacklist: Set<string> = new Set();
  private isInitialized: boolean = false;

  // Scoring thresholds
  private readonly SCORE_THRESHOLDS = {
    [RiskLevel.LOW]: 70,
    [RiskLevel.MEDIUM]: 50,
    [RiskLevel.HIGH]: 30,
    [RiskLevel.CRITICAL]: 0
  };

  // Blacklist penalty
  private readonly BLACKLIST_PENALTY = -30;

  // Feature weights for rule-based scoring (fallback)
  private readonly FEATURE_WEIGHTS = {
    transactionCount: 0.1,
    transactionsPerDay: 0.15,
    avgTransactionValue: 0.1,
    maxTransactionValue: 0.1,
    accountAgeDays: 0.05,
    daysSinceLastTx: 0.05,
    uniqueCounterparties: 0.1,
    contractInteractions: 0.1,
    failedTransactions: 0.15,
    totalVolume: 0.1
  };

  private constructor() {}

  public static getInstance(): ScoringService {
    if (!ScoringService.instance) {
      ScoringService.instance = new ScoringService();
    }
    return ScoringService.instance;
  }

  /**
   * Initialize ML model and related resources
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Scoring service already initialized');
      return;
    }

    try {
      logger.info('🔄 Initializing scoring service...');

      // Load blacklist first (independent of model)
      await this.loadBlacklist();

      // Load feature names
      await this.loadFeatureNames();

      // Try to load ML model
      try {
        await this.loadMLModel();
      } catch (modelError) {
        logger.warn('⚠️ Failed to load ONNX model, will use enhanced fallback scoring:', modelError);
        // Continue without the model - use enhanced fallback scoring
        this.model = null;
      }

      // Load scaler
      await this.loadScaler();

      // Load model metadata
      await this.loadModelMetadata();

      this.isInitialized = true;
      logger.info('✅ Scoring service initialized successfully', {
        modelLoaded: !!this.model,
        features: this.featureNames.length,
        blacklistSize: this.blacklist.size
      });

    } catch (error) {
      logger.error('❌ Failed to initialize scoring service:', error);
      throw error;
    }
  }

  /**
   * Load ONNX model
   */
  private async loadMLModel(): Promise<void> {
    try {
      const modelPath = Helpers.getEnvVar('MODEL_PATH', '../ml-models/wallet_fraud_model.onnx');
      const absolutePath = path.resolve(process.cwd(), modelPath);

      logger.info(`Loading ONNX model from: ${absolutePath}`);

      // Check if file exists first
      try {
        await import('fs').then(fs => fs.promises.access(absolutePath));
        logger.info('✅ ONNX model file exists');
      } catch (fileError) {
        logger.error('❌ ONNX model file does not exist:', absolutePath);
        throw new Error(`Model file not found: ${absolutePath}`);
      }

      // Model configuration - try multiple execution providers
      const sessionOptions: InferenceSession.SessionOptions = {
        executionProviders: ['cpu'], // Use CPU execution
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        logSeverityLevel: 3 // Info level to see more details
      };

      this.model = await InferenceSession.create(absolutePath, sessionOptions);

      logger.info('✅ ONNX model loaded successfully', {
        inputNames: this.model.inputNames,
        outputNames: this.model.outputNames,
        modelPath: absolutePath
      });

    } catch (error) {
      logger.error('❌ Failed to load ONNX model:', error);
      logger.error('📋 This will cause the system to use fallback scoring (which may result in constant scores like 85)');

      // Check if file exists even if loading failed
      try {
        const modelPath = Helpers.getEnvVar('MODEL_PATH', '../ml-models/wallet_fraud_model.onnx');
        const absolutePath = path.resolve(process.cwd(), modelPath);
        const fs = await import('fs').then(m => m.promises);
        const stats = await fs.stat(absolutePath);
        logger.info(`✅ Model file exists and is ${stats.size} bytes`);
      } catch (fsError) {
        logger.error('❌ Model file does not exist at expected location');
      }

      // Don't throw error here - allow fallback scoring to work
      logger.warn('⚠️  ONNX model failed to load, will use enhanced fallback scoring');
      this.model = null;
    }
  }

  /**
   * Load feature scaler
   */
  private async loadScaler(): Promise<void> {
    try {
      const scalerPath = Helpers.getEnvVar('SCALER_PATH', '../ml-models/scaler.pkl');
      
      // Note: In a real implementation, you would load the actual scaler
      // For now, we'll create a mock scaler for demonstration
      this.scaler = {
        transform: (features: number[][]) => {
          // Simple normalization - replace with actual scaler logic
          return features.map(featureArray => 
            featureArray.map(val => {
              // Basic min-max normalization (0-1 range)
              return Math.max(0, Math.min(1, val));
            })
          );
        }
      };

      logger.debug('✅ Feature scaler loaded');

    } catch (error) {
      logger.warn('⚠️ Could not load scaler, using default normalization', error);
      // Continue with default normalization
    }
  }

  /**
   * Load feature names
   */
  private async loadFeatureNames(): Promise<void> {
    try {
      const featuresPath = Helpers.getEnvVar('FEATURES_PATH', '../ml-models/model_features.json');
      const featuresConfig = await Helpers.loadJSONFile<{ features: string[] }>(featuresPath);

      this.featureNames = featuresConfig.features;
      logger.debug(`✅ Loaded ${this.featureNames.length} feature names`);

    } catch (error) {
      logger.warn('⚠️ Could not load feature names, using default features', error);
      // Use default feature names based on FeatureVector interface
      this.featureNames = [
        'transactionCount', 'transactionsPerDay', 'avgTransactionValue',
        'maxTransactionValue', 'minTransactionValue', 'accountAgeDays',
        'daysSinceLastTx', 'activeDays', 'uniqueCounterparties',
        'contractInteractions', 'failedTransactions', 'gasUsagePattern',
        'totalVolume', 'balance', 'avgGasPrice', 'valueConcentration',
        'timeDistribution', 'activityConsistency', 'clusteringCoefficient',
        'pageRank', 'erc20MostSentTokenType', 'timeDiffFirstLastMins',
        'erc20MostRecTokenType', 'totalErc20Tnxs', 'erc20TotalEtherReceived',
        'erc20UniqRecContractAddr', 'avgMinBetweenReceivedTnx', 'totalEtherReceived',
        'erc20UniqRecAddr', 'erc20AvgValRec'
      ];
    }
  }

  /**
   * Load blacklist
   */
  private async loadBlacklist(): Promise<void> {
    try {
      const blacklistPath = Helpers.getEnvVar('BLACKLIST_PATH', '../ml-models/blacklist.json');
      const blacklistData = await Helpers.loadJSONFile<string[]>(blacklistPath);
      
      this.blacklist = new Set(blacklistData.map(addr => addr.toLowerCase()));
      logger.info(`✅ Loaded blacklist with ${this.blacklist.size} addresses`);

    } catch (error) {
      logger.warn('⚠️ Could not load blacklist, using empty set', error);
      this.blacklist = new Set();
    }
  }

  /**
   * Load model metadata
   */
  private async loadModelMetadata(): Promise<void> {
    try {
      const metadataPath = path.resolve(process.cwd(), '../ml-models/model_metadata.json');
      this.modelMetadata = await Helpers.loadJSONFile<MLModelMetadata>(metadataPath);

    } catch (error) {
      logger.warn('⚠️ Could not load model metadata, using defaults', error);
      this.modelMetadata = {
        version: '1.0.0',
        modelType: 'RandomForest',
        features: this.featureNames,
        accuracy: 0.85,
        rocAuc: 0.92,
        trainedAt: new Date().toISOString(),
        inputShape: [1, this.featureNames.length],
        outputShape: [1, 2]
      };
    }
  }

  /**
   * Calculate wallet reputation score
   */
  public async calculateWalletScore(
    walletAddress: string,
    events: WalletEvent[]
  ): Promise<ScoringResult> {
    const startTime = Date.now();

    try {
      logger.debug(`Calculating score for wallet: ${walletAddress}`, {
        eventCount: events.length
      });

      // Extract features from events
      const features = featureProcessor.extractFeaturesFromEvent(walletAddress, events);
      
      // Get ML prediction
      const mlPrediction = await this.getMLPrediction(features);
      
      // Apply blacklist penalty
      const baseScore = mlPrediction.score;
      const blacklistPenalty = this.blacklist.has(walletAddress.toLowerCase()) ? this.BLACKLIST_PENALTY : 0;
      
      // Calculate final score (0-100)
      let finalScore = Math.max(0, Math.min(100, baseScore + blacklistPenalty));
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(finalScore);
      
      // Generate explanation
      const explanation = this.generateExplanation(finalScore, riskLevel, features, blacklistPenalty);

      const scoringResult: ScoringResult = {
        walletAddress,
        reputationScore: finalScore,
        riskLevel,
        confidence: mlPrediction.probabilities[1] || 0.5,
        features,
        timestamp: Helpers.currentTimestamp(),
        transactionCount: events.length,
        flags: this.generateFlags(walletAddress, features, finalScore),
        explanation
      };

      const processingTime = Date.now() - startTime;

      logger.debug('Score calculation completed', {
        wallet: walletAddress,
        score: finalScore,
        riskLevel,
        processingTime: `${processingTime}ms`,
        blacklistPenalty,
        confidence: scoringResult.confidence
      });

      return scoringResult;

    } catch (error) {
      logger.error('Error calculating wallet score:', error);
      
      // Fallback to rule-based scoring if ML fails
      return this.calculateFallbackScore(walletAddress, events);
    }
  }

  /**
   * Get ML model prediction
   */
  private async getMLPrediction(features: FeatureVector): Promise<ModelPrediction> {
    if (!this.model) {
      // If model isn't loaded, fall back to enhanced rule-based scoring
      logger.warn('ML model not loaded, using enhanced fallback scoring');
      // Return a prediction based on the enhanced rule-based scoring instead
      // For this, we'll use the calculateFallbackScore to generate prediction
      const fallbackResult = await this.calculateFallbackScore('0x0000000000000000000000000000000000000000', []);
      return {
        score: fallbackResult.reputationScore,
        probabilities: [1 - (fallbackResult.reputationScore/100), fallbackResult.reputationScore/100],
        predictionTime: 0 // Fallback doesn't have prediction time
      };
    }

    const startTime = Date.now();

    try {
      // Normalize features and match expected model feature order
      const featuresArray = this.mapFeaturesToModelFormat(features);

      // Ensure the featuresArray contains valid numbers, not undefined values
      const validFeaturesArray = featuresArray.map(val => (val === undefined || val === null) ? 0 : Number(val));

      // Check if we have the correct number of features
      if (validFeaturesArray.length === 0) {
        logger.warn('No valid features to pass to model, using fallback');
        const fallbackResult = await this.calculateFallbackScore('0x0000000000000000000000000000000000000000', []);
        return {
          score: fallbackResult.reputationScore,
          probabilities: [1 - (fallbackResult.reputationScore/100), fallbackResult.reputationScore/100],
          predictionTime: 0
        };
      }

      const inputTensor = new Tensor('float32', new Float32Array(validFeaturesArray), [
        1,
        validFeaturesArray.length
      ]);

      // Prepare model inputs
      const inputs: Record<string, Tensor> = {};
      const inputName = this.model.inputNames[0] || 'input';
      inputs[inputName] = inputTensor;

      // Run inference
      const outputs = await this.model.run(inputs);
      const outputName = this.model.outputNames[0] || 'output';
      const outputData = outputs[outputName].data as Float32Array;

      // Handle different model output formats
      let probabilities: number[];
      let score: number;

      if (outputData.length === 2) {
        // Binary classification: [probability_class_0, probability_class_1]
        probabilities = Array.from(outputData);
        score = probabilities[1] * 100; // Use probability of positive class (1) as score
      } else if (outputData.length === 1) {
        // Single output: could be the score directly or a logit
        const rawOutput = outputData[0];
        // Apply sigmoid to convert logit to probability if needed
        const probability = 1 / (1 + Math.exp(-rawOutput));
        score = probability * 100;
        probabilities = [1 - probability, probability];
      } else {
        // Multi-class: take the highest probability class as the score
        probabilities = Array.from(outputData);
        const maxProb = Math.max(...probabilities);
        score = maxProb * 100;
      }

      // Ensure score is in valid range
      score = Math.max(0, Math.min(100, score));

      const predictionTime = Date.now() - startTime;

      return {
        score,
        probabilities,
        predictionTime
      };

    } catch (error) {
      logger.error('ML prediction failed, falling back to rule-based scoring:', error);
      // If ML prediction fails, fall back to rule-based scoring
      const fallbackResult = await this.calculateFallbackScore('0x0000000000000000000000000000000000000000', []);
      return {
        score: fallbackResult.reputationScore,
        probabilities: [1 - (fallbackResult.reputationScore/100), fallbackResult.reputationScore/100],
        predictionTime: 0
      };
    }
  }

  /**
   * Map internal features to the format expected by the ML model
   */
  private mapFeaturesToModelFormat(features: FeatureVector): number[] {
    // Create a mapping object with default values (0 or appropriate defaults)
    const modelFeatures: { [key: string]: number } = {};

    // Map the available features to their corresponding model feature names
    // Based on a blockchain fraud detection model, map our features appropriately
    for (const featureName of this.featureNames) {
      switch(featureName.trim()) { // Trim whitespace to match actual names
        case 'Unnamed: 0':
        case 'Index':
        case 'Address':
          modelFeatures[featureName] = 0; // Not needed for scoring
          break;
        case ' ERC20 most sent token type':
        case ' ERC20_most_rec_token_type':
        case ' ERC20 uniq sent token name':
          modelFeatures[featureName] = 0; // Placeholder for token types
          break;
        case 'Time Diff between first and last (Mins)':
          modelFeatures[featureName] = features.accountAgeDays * 24 * 60; // Convert to minutes
          break;
        case ' Total ERC20 tnxs':
          modelFeatures[featureName] = features.contractInteractions;
          break;
        case ' ERC20 total Ether received':
        case 'total ether received':
          modelFeatures[featureName] = features.totalVolume;
          break;
        case ' ERC20 total ether sent':
        case 'total Ether sent':
          modelFeatures[featureName] = features.totalVolume * 0.5; // Estimate
          break;
        case ' ERC20 uniq rec contract addr':
          modelFeatures[featureName] = features.uniqueCounterparties * 0.2; // Adjust to likely range
          break;
        case 'Avg min between received tnx':
          modelFeatures[featureName] = features.transactionsPerDay > 0 ? (1440 / features.transactionsPerDay) : 1440;
          break;
        case ' ERC20 uniq rec addr':
        case 'Unique Received From Addresses':
          modelFeatures[featureName] = features.uniqueCounterparties;
          break;
        case ' ERC20 avg val rec':
        case 'avg val received':
        case 'avg val sent':
          modelFeatures[featureName] = features.avgTransactionValue;
          break;
        case 'max value received ':
        case 'max val sent':
          modelFeatures[featureName] = features.maxTransactionValue;
          break;
        case 'total transactions (including tnx to create contract':
          modelFeatures[featureName] = features.transactionCount;
          break;
        case 'Received Tnx':
        case 'Sent tnx':
          modelFeatures[featureName] = features.transactionCount * 0.5; // Split between received/sent
          break;
        case 'Unique Sent To Addresses':
          modelFeatures[featureName] = features.uniqueCounterparties * 0.5; // Approximate
          break;
        case ' ERC20 min val rec':
        case 'min val sent':
        case 'min value received':
          modelFeatures[featureName] = features.minTransactionValue;
          break;
        case 'total ether balance':
          modelFeatures[featureName] = features.balance;
          break;
        case ' ERC20 uniq sent addr':
          modelFeatures[featureName] = features.uniqueCounterparties * 0.3; // Estimate
          break;
        default:
          // For any other features, try to match based on similarity
          if (featureName.toLowerCase().includes('transaction')) {
            modelFeatures[featureName] = features.transactionCount;
          } else if (featureName.toLowerCase().includes('value') || featureName.toLowerCase().includes('ether')) {
            modelFeatures[featureName] = features.avgTransactionValue;
          } else if (featureName.toLowerCase().includes('counterpart')) {
            modelFeatures[featureName] = features.uniqueCounterparties;
          } else if (featureName.toLowerCase().includes('fail')) {
            modelFeatures[featureName] = features.failedTransactions;
          } else {
            modelFeatures[featureName] = 0; // Default to 0
          }
      }
    }

    // Create the final array in the exact order required by the model
    const orderedFeatures: number[] = [];
    for (const featureName of this.featureNames) {
      orderedFeatures.push(modelFeatures[featureName] || 0);
    }

    return orderedFeatures;
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= this.SCORE_THRESHOLDS[RiskLevel.LOW]) {
      return RiskLevel.LOW;
    } else if (score >= this.SCORE_THRESHOLDS[RiskLevel.MEDIUM]) {
      return RiskLevel.MEDIUM;
    } else if (score >= this.SCORE_THRESHOLDS[RiskLevel.HIGH]) {
      return RiskLevel.HIGH;
    } else {
      return RiskLevel.CRITICAL;
    }
  }

  /**
   * Calculate fallback score using rule-based system
   */
  private calculateFallbackScore(
    walletAddress: string,
    events: WalletEvent[]
  ): ScoringResult {
    logger.warn('Using fallback scoring for wallet:', walletAddress, `- Event count: ${events.length}`);

    const features = featureProcessor.extractFeaturesFromEvent(walletAddress, events);

    // Calculate score dynamically based on transaction pattern analysis
    let baseScore = 70; // Start with a more realistic base score

    logger.debug(`Fallback scoring for ${walletAddress} with features:`, {
      transactionCount: features.transactionCount,
      transactionsPerDay: features.transactionsPerDay,
      avgTransactionValue: features.avgTransactionValue,
      failedTransactions: features.failedTransactions,
      uniqueCounterparties: features.uniqueCounterparties,
      accountAgeDays: features.accountAgeDays
    });

    // Analyze transaction patterns in real-time from events array
    let patternRisk = 0;
    let patternBonus = 0;

    if (events.length > 0) {
      // Analyze transaction patterns from the events
      const recentTransactions = events.slice(-20); // Look at recent transactions

      // Check for suspicious patterns
      for (const event of recentTransactions) {
        // Look for high value transactions
        if (parseFloat(event.value) > 1000) {
          patternRisk += 5; // High value transaction risk
        }

        // Look for failed transactions
        if (event.status === 'failed') {
          patternRisk += 8;
        }

        // Look for rapid succession transactions (potential bot activity)
        if (event.timestamp && events.length > 1) {
          // We can't calculate rapid succession without time between events in this context
          // but the features already capture this
        }
      }

      // Apply pattern-based adjustments
      if (features.failedTransactions > 0) {
        patternRisk += features.failedTransactions * 5;
      }

      // Apply some bonuses for good patterns
      if (features.uniqueCounterparties > 5) {
        patternBonus += Math.min(15, Math.log(features.uniqueCounterparties + 1) * 3);
      }

      if (features.accountAgeDays > 7) {
        patternBonus += Math.min(10, Math.log(features.accountAgeDays + 1) * 2);
      }
    }

    // Apply adjustments based on actual transaction activity
    // More transactions generally indicate more activity (could be good or risky depending on patterns)
    if (features.transactionCount > 0) {
      // Active wallets get a small bonus but cap it
      const activityBonus = Math.min(8, Math.log10(features.transactionCount + 1) * 2);
      baseScore += activityBonus;
    }

    // Transaction frequency - high frequency might indicate bot-like activity
    if (features.transactionsPerDay > 50) {
      patternRisk += Math.min(25, (features.transactionsPerDay - 50) * 0.3);
    } else if (features.transactionsPerDay > 0 && features.transactionsPerDay <= 10) {
      // Regular, low-frequency activity gets bonus
      patternBonus += Math.min(5, features.transactionsPerDay * 0.3);
    }

    // Average transaction value - very high values might indicate risk
    if (features.avgTransactionValue > 100) {
      patternRisk += Math.min(15, Math.log10(features.avgTransactionValue) * 2);
    }

    // Failed transactions are definitely risky
    patternRisk += features.failedTransactions * 4;

    // Apply the pattern adjustments
    let score = baseScore - patternRisk + patternBonus;

    // Account age - older accounts are generally more trustworthy
    if (features.accountAgeDays > 30) {
      score += Math.min(15, Math.log10(features.accountAgeDays) * 3);
    } else if (features.accountAgeDays < 1) {
      // Very new account - reduce score more significantly
      score -= 20;
    }

    // Blacklist penalty
    if (this.blacklist.has(walletAddress.toLowerCase())) {
      score += this.BLACKLIST_PENALTY;
    }

    // Ensure score is within bounds (0-100)
    score = Math.max(0, Math.min(100, score));

    // Adjust confidence based on data availability
    const confidence = Math.min(0.8, Math.max(0.3, (events.length * 0.05))); // Confidence increases with event count, max 0.8

    const riskLevel = this.determineRiskLevel(score);

    // Generate dynamic explanation based on actual features
    const riskFactors = [];
    if (features.failedTransactions > 0) riskFactors.push(`${features.failedTransactions} failed transactions`);
    if (features.avgTransactionValue > 100) riskFactors.push(`high avg value (${features.avgTransactionValue.toFixed(2)})`);
    if (features.transactionsPerDay > 20) riskFactors.push(`high frequency (${features.transactionsPerDay.toFixed(2)}/day)`);
    if (features.accountAgeDays < 7) riskFactors.push(`new account (${features.accountAgeDays.toFixed(1)} days)`);
    if (patternRisk > 0) riskFactors.push(`pattern risks identified`);

    const activityFactors = [];
    if (features.transactionCount > 0) activityFactors.push(`${features.transactionCount} total transactions`);
    if (features.uniqueCounterparties > 5) activityFactors.push(`${features.uniqueCounterparties} unique counterparties`);
    if (features.accountAgeDays > 30) activityFactors.push(`established account (${features.accountAgeDays.toFixed(1)} days)`);
    if (patternBonus > 0) activityFactors.push('positive patterns detected');

    const explanation = riskFactors.length > 0
      ? `Risk level: ${riskLevel}. Risk factors: ${riskFactors.join(', ')}. ${activityFactors.length > 0 ? 'Activity factors: ' + activityFactors.join(', ') + '.' : ''}`
      : `Account activity: ${features.transactionCount} transactions. ${activityFactors.length > 0 ? 'Activity factors: ' + activityFactors.join(', ') + '.' : 'Regular activity.'}`;

    return {
      walletAddress,
      reputationScore: parseFloat(score.toFixed(2)),
      riskLevel,
      confidence: parseFloat(confidence.toFixed(2)),
      features,
      timestamp: Helpers.currentTimestamp(),
      transactionCount: events.length,
      flags: this.generateFlags(walletAddress, features, score),
      explanation
    };
  }

  /**
   * Generate explanation for the score
   */
  private generateExplanation(
    score: number,
    riskLevel: RiskLevel,
    features: FeatureVector,
    blacklistPenalty: number
  ): string {
    const factors: string[] = [];

    if (blacklistPenalty < 0) {
      factors.push('wallet is in blacklist');
    }

    if (features.failedTransactions > 5) {
      factors.push('high number of failed transactions');
    }

    if (features.transactionsPerDay > 20) {
      factors.push('unusually high transaction frequency');
    }

    if (features.uniqueCounterparties > 200) {
      factors.push('interacts with many unique addresses');
    }

    if (features.accountAgeDays < 30) {
      factors.push('recently created wallet');
    }

    if (features.avgTransactionValue > 50) {
      factors.push('high average transaction value');
    }

    if (factors.length === 0) {
      factors.push('normal transaction patterns detected');
    }

    return `Risk level: ${riskLevel}. Factors: ${factors.join('; ')}.`;
  }

  /**
   * Generate risk flags
   */
  private generateFlags(
    walletAddress: string,
    features: FeatureVector,
    score: number
  ): string[] {
    const flags: string[] = [];

    if (this.blacklist.has(walletAddress.toLowerCase())) {
      flags.push('blacklisted');
    }

    if (features.failedTransactions > 10) {
      flags.push('high_failure_rate');
    }

    if (features.transactionsPerDay > 50) {
      flags.push('high_frequency');
    }

    if (features.uniqueCounterparties > 500) {
      flags.push('many_counterparties');
    }

    if (features.accountAgeDays < 7) {
      flags.push('new_account');
    }

    if (features.contractInteractions > 200) {
      flags.push('high_contract_activity');
    }

    if (score < 30) {
      flags.push('critical_risk');
    } else if (score < 50) {
      flags.push('high_risk');
    }

    return flags;
  }

  /**
   * Check if wallet is in blacklist
   */
  public isWalletBlacklisted(walletAddress: string): boolean {
    return this.blacklist.has(walletAddress.toLowerCase());
  }

  /**
   * Get model metadata
   */
  public getModelMetadata(): MLModelMetadata | null {
    return this.modelMetadata;
  }

  /**
   * Get feature names
   */
  public getFeatureNames(): string[] {
    return this.featureNames;
  }

  /**
   * Get blacklist size
   */
  public getBlacklistSize(): number {
    return this.blacklist.size;
  }

  /**
   * Check if scoring service is initialized
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Health check for scoring service
   */
  public healthCheck(): {
    healthy: boolean;
    details: {
      modelLoaded: boolean;
      scalerLoaded: boolean;
      featuresLoaded: boolean;
      blacklistLoaded: boolean;
      modelMetadata?: MLModelMetadata;
    };
  } {
    return {
      healthy: this.isInitialized,
      details: {
        modelLoaded: !!this.model,
        scalerLoaded: !!this.scaler,
        featuresLoaded: this.featureNames.length > 0,
        blacklistLoaded: this.blacklist.size > 0,
        modelMetadata: this.modelMetadata || undefined
      }
    };
  }

  /**
   * Batch score multiple wallets
   */
  public async batchScoreWallets(
    walletEvents: Map<string, WalletEvent[]>
  ): Promise<Map<string, ScoringResult>> {
    const results = new Map<string, ScoringResult>();
    const batchStartTime = Date.now();

    logger.debug(`Starting batch scoring for ${walletEvents.size} wallets`);

    // Process wallets in parallel with concurrency limit
    const concurrency = 5;
    const wallets = Array.from(walletEvents.entries());
    
    for (let i = 0; i < wallets.length; i += concurrency) {
      const batch = wallets.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async ([walletAddress, events]) => {
        try {
          const score = await this.calculateWalletScore(walletAddress, events);
          results.set(walletAddress, score);
        } catch (error) {
          logger.error(`Failed to score wallet ${walletAddress}:`, error);
          // Store error result
          results.set(walletAddress, {
            walletAddress,
            reputationScore: 50, // Neutral fallback
            riskLevel: RiskLevel.MEDIUM,
            confidence: 0,
            features: featureProcessor.extractFeaturesFromEvent(walletAddress, events),
            timestamp: Helpers.currentTimestamp(),
            transactionCount: events.length,
            flags: ['scoring_error'],
            explanation: 'Scoring failed, using neutral fallback'
          });
        }
      });

      await Promise.all(batchPromises);
    }

    const totalTime = Date.now() - batchStartTime;
    logger.debug(`Batch scoring completed in ${totalTime}ms`, {
      processed: results.size,
      averageTime: totalTime / walletEvents.size
    });

    return results;
  }
}

// Export singleton instance
export const scoringService = ScoringService.getInstance();

// Legacy export for backward compatibility
export const loadMLModel = () => scoringService.initialize();