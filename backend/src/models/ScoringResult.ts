/**
 * Scoring Result Data Models
 * Represents ML scoring results and risk assessments
 */

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ScoringResult {
  walletAddress: string;
  reputationScore: number; // 0-100
  riskLevel: RiskLevel;
  confidence: number; // 0-1
  features: FeatureVector;
  timestamp: number;
  transactionCount?: number;
  flags: string[];
  explanation?: string;
}

export interface FeatureVector {
  // Transaction frequency features
  transactionCount: number;
  transactionsPerDay: number;
  avgTransactionValue: number;
  maxTransactionValue: number;
  minTransactionValue: number;
  
  // Time-based features
  accountAgeDays: number;
  daysSinceLastTx: number;
  activeDays: number;
  
  // Behavioral features
  uniqueCounterparties: number;
  contractInteractions: number;
  failedTransactions: number;
  gasUsagePattern: number;
  
  // Value-based features
  totalVolume: number;
  balance: number;
  avgGasPrice: number;
  
  // Network features
  clusteringCoefficient?: number;
  pageRank?: number;
  
  // Derived features
  valueConcentration: number;
  timeDistribution: number;
  activityConsistency: number;
}

export interface MLModelMetadata {
  version: string;
  modelType: string;
  features: string[];
  accuracy: number;
  rocAuc: number;
  trainedAt: string;
  inputShape: number[];
  outputShape: number[];
}

export interface ModelPrediction {
  score: number;
  probabilities: number[];
  featureImportance?: { [key: string]: number };
  predictionTime: number;
}