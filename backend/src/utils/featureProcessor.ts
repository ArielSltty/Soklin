/**
 * Feature Processing Utilities
 * Transforms blockchain events into ML model features
 */

import { WalletEvent, TransactionData } from '../models/WalletEvent';
import { FeatureVector } from '../models/ScoringResult';
import { logger } from '../config/logging';

export class FeatureProcessor {
  private transactionHistory: Map<string, WalletEvent[]> = new Map();
  private readonly MAX_HISTORY = 1000;

  /**
   * Extract features from wallet events for ML model
   */
  public extractFeaturesFromEvent(walletAddress: string, events: WalletEvent[]): FeatureVector {
    try {
      // Update transaction history
      this.updateTransactionHistory(walletAddress, events);

      const walletEvents = this.transactionHistory.get(walletAddress) || [];
      
      // Calculate basic features
      const transactionCount = walletEvents.length;
      const successfulTxs = walletEvents.filter(tx => tx.status === 'success');
      const failedTxs = walletEvents.filter(tx => tx.status === 'failed');
      
      // Value-based features
      const values = successfulTxs.map(tx => parseFloat(tx.value));
      const totalVolume = values.reduce((sum, val) => sum + val, 0);
      const avgTransactionValue = values.length > 0 ? totalVolume / values.length : 0;
      const maxTransactionValue = values.length > 0 ? Math.max(...values) : 0;
      const minTransactionValue = values.length > 0 ? Math.min(...values) : 0;

      // Time-based features
      const now = Date.now() / 1000;
      const timestamps = walletEvents.map(tx => tx.timestamp);
      const accountAgeDays = timestamps.length > 0 ? 
        (now - Math.min(...timestamps)) / (24 * 60 * 60) : 0;
      const daysSinceLastTx = timestamps.length > 0 ? 
        (now - Math.max(...timestamps)) / (24 * 60 * 60) : 365; // Default to 1 year if no tx

      // Behavioral features
      const uniqueCounterparties = new Set(
        walletEvents.flatMap(tx => [tx.from, tx.to].filter(Boolean))
      ).size;

      const contractInteractions = walletEvents.filter(tx => 
        tx.contractAddress || (tx.input && tx.input.length > 10)
      ).length;

      const gasPrices = walletEvents.map(tx => parseFloat(tx.gasPrice));
      const avgGasPrice = gasPrices.length > 0 ? 
        gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length : 0;

      // Calculate activity patterns
      const activeDays = this.calculateActiveDays(walletEvents);
      const transactionsPerDay = accountAgeDays > 0 ? transactionCount / accountAgeDays : 0;
      
      // Derived features
      const valueConcentration = maxTransactionValue > 0 ? 
        avgTransactionValue / maxTransactionValue : 0;
      
      const activityConsistency = this.calculateActivityConsistency(walletEvents);
      const timeDistribution = this.calculateTimeDistribution(walletEvents);

      const features: FeatureVector = {
        // Transaction frequency
        transactionCount,
        transactionsPerDay: Math.min(transactionsPerDay, 100), // Cap at 100
        avgTransactionValue: this.normalizeValue(avgTransactionValue),
        maxTransactionValue: this.normalizeValue(maxTransactionValue),
        minTransactionValue: this.normalizeValue(minTransactionValue),
        
        // Time-based
        accountAgeDays: Math.min(accountAgeDays, 365 * 5), // Cap at 5 years
        daysSinceLastTx: Math.min(daysSinceLastTx, 365), // Cap at 1 year
        activeDays: Math.min(activeDays, 365 * 2), // Cap at 2 years
        
        // Behavioral
        uniqueCounterparties,
        contractInteractions,
        failedTransactions: failedTxs.length,
        gasUsagePattern: this.normalizeGasPattern(avgGasPrice),
        
        // Value-based
        totalVolume: this.normalizeValue(totalVolume),
        balance: 0, // Would need to fetch from blockchain
        avgGasPrice: this.normalizeValue(avgGasPrice),
        
        // Derived features
        valueConcentration,
        timeDistribution,
        activityConsistency,
        
        // Network features (would require graph analysis)
        clusteringCoefficient: 0,
        pageRank: 0
      };

      logger.debug(`Extracted features for ${walletAddress}`, {
        transactionCount: features.transactionCount,
        riskIndicators: {
          highVolume: features.totalVolume > 1000,
          manyCounterparties: features.uniqueCounterparties > 50,
          recentActivity: features.daysSinceLastTx < 1
        }
      });

      return features;

    } catch (error) {
      logger.error('Error extracting features:', error);
      return this.getDefaultFeatures();
    }
  }

  /**
   * Normalize feature values for ML model
   */
  public normalizeFeatures(features: FeatureVector): number[] {
    const normalized: number[] = [];

    // Normalize each feature to 0-1 range
    normalized.push(this.normalizeFeature(features.transactionCount, 0, 10000));
    normalized.push(this.normalizeFeature(features.transactionsPerDay, 0, 100));
    normalized.push(this.normalizeFeature(features.avgTransactionValue, 0, 1000));
    normalized.push(this.normalizeFeature(features.maxTransactionValue, 0, 10000));
    normalized.push(this.normalizeFeature(features.minTransactionValue, 0, 1000));
    normalized.push(this.normalizeFeature(features.accountAgeDays, 0, 365 * 5));
    normalized.push(this.normalizeFeature(features.daysSinceLastTx, 0, 365));
    normalized.push(this.normalizeFeature(features.activeDays, 0, 365 * 2));
    normalized.push(this.normalizeFeature(features.uniqueCounterparties, 0, 1000));
    normalized.push(this.normalizeFeature(features.contractInteractions, 0, 1000));
    normalized.push(this.normalizeFeature(features.failedTransactions, 0, 100));
    normalized.push(this.normalizeFeature(features.gasUsagePattern, 0, 1));
    normalized.push(this.normalizeFeature(features.totalVolume, 0, 1000000));
    normalized.push(this.normalizeFeature(features.balance, 0, 100000));
    normalized.push(this.normalizeFeature(features.avgGasPrice, 0, 1000));
    normalized.push(this.normalizeFeature(features.valueConcentration, 0, 1));
    normalized.push(this.normalizeFeature(features.timeDistribution, 0, 1));
    normalized.push(this.normalizeFeature(features.activityConsistency, 0, 1));
    normalized.push(this.normalizeFeature(features.clusteringCoefficient || 0, 0, 1));
    normalized.push(this.normalizeFeature(features.pageRank || 0, 0, 1));

    return normalized;
  }

  /**
   * Calculate number of unique days with activity
   */
  private calculateActiveDays(events: WalletEvent[]): number {
    const uniqueDays = new Set(
      events.map(tx => {
        const date = new Date(tx.timestamp * 1000);
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      })
    );
    return uniqueDays.size;
  }

  /**
   * Calculate consistency of activity over time
   */
  private calculateActivityConsistency(events: WalletEvent[]): number {
    if (events.length < 2) return 0;

    const timestamps = events.map(tx => tx.timestamp).sort();
    const intervals: number[] = [];

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
    const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
    
    // Lower variance = more consistent
    return Math.max(0, 1 - (variance / (avgInterval * avgInterval)));
  }

  /**
   * Calculate distribution of transactions across time
   */
  private calculateTimeDistribution(events: WalletEvent[]): number {
    if (events.length === 0) return 0;

    const hours = new Array(24).fill(0);
    events.forEach(tx => {
      const date = new Date(tx.timestamp * 1000);
      hours[date.getHours()]++;
    });

    // Calculate entropy (higher entropy = more distributed)
    const total = hours.reduce((sum, count) => sum + count, 0);
    const probabilities = hours.map(count => count / total);
    const entropy = probabilities.reduce((sum, p) => p > 0 ? sum - p * Math.log2(p) : sum, 0);
    
    return entropy / Math.log2(24); // Normalize to 0-1
  }

  private normalizeFeature(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private normalizeValue(value: number): number {
    // Convert ETH values (values might be in different units, so handle appropriately)
    // If value is already in ETH format (not wei), return as is
    // If value is extremely large, it might be in wei
    if (value > 1e15) {
      // Probably in wei, convert to ETH
      return value / 1e18;
    } else {
      // Probably already in ETH
      return value;
    }
  }

  private normalizeGasPattern(gasPrice: number): number {
    // Normalize gas price pattern (0-1000 Gwei range)
    return Math.min(gasPrice / 1e9 / 1000, 1);
  }

  private updateTransactionHistory(walletAddress: string, newEvents: WalletEvent[]): void {
    const current = this.transactionHistory.get(walletAddress) || [];
    const updated = [...current, ...newEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_HISTORY);
    
    this.transactionHistory.set(walletAddress, updated);
  }

  private getDefaultFeatures(): FeatureVector {
    return {
      transactionCount: 0,
      transactionsPerDay: 0,
      avgTransactionValue: 0,
      maxTransactionValue: 0,
      minTransactionValue: 0,
      accountAgeDays: 0,
      daysSinceLastTx: 365,
      activeDays: 0,
      uniqueCounterparties: 0,
      contractInteractions: 0,
      failedTransactions: 0,
      gasUsagePattern: 0,
      totalVolume: 0,
      balance: 0,
      avgGasPrice: 0,
      valueConcentration: 0,
      timeDistribution: 0,
      activityConsistency: 0,
      clusteringCoefficient: 0,
      pageRank: 0
    };
  }

  /**
   * Clear history for a wallet (for testing and cleanup)
   */
  public clearHistory(walletAddress: string): void {
    this.transactionHistory.delete(walletAddress);
  }

  /**
   * Get current history size for monitoring
   */
  public getHistorySize(walletAddress: string): number {
    return this.transactionHistory.get(walletAddress)?.length || 0;
  }
}

// Export singleton instance
export const featureProcessor = new FeatureProcessor();