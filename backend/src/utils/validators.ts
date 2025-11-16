/**
 * Validation Utilities
 * Input validation and sanitization functions
 */

import { ethers } from 'ethers';
import { SubscribeWalletRequest, ValidationResult } from '../models/ApiModels';
import { logger } from '../config/logging';

export class Validators {
  /**
   * Validate Ethereum address format
   */
  public static isValidEthereumAddress(address: string): ValidationResult {
    const errors: string[] = [];

    if (!address) {
      errors.push('Address is required');
      return { isValid: false, errors };
    }

    // Basic format check
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      errors.push('Invalid Ethereum address format');
    }

    // Checksum validation
    try {
      const checksumAddress = ethers.getAddress(address);
      return {
        isValid: errors.length === 0,
        errors,
        normalized: checksumAddress
      };
    } catch (error) {
      errors.push('Invalid address checksum');
      return { isValid: false, errors };
    }
  }

  /**
   * Validate wallet subscription request
   */
  public static validateWalletRequest(request: SubscribeWalletRequest): ValidationResult<SubscribeWalletRequest> {
    const errors: string[] = [];

    // Validate wallet address
    const addressValidation = this.isValidEthereumAddress(request.wallet);
    if (!addressValidation.isValid) {
      errors.push(...addressValidation.errors);
    }

    // Validate session ID if provided
    if (request.sessionId && !this.isValidSessionId(request.sessionId)) {
      errors.push('Invalid session ID format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized: {
        ...request,
        wallet: addressValidation.normalized || request.wallet
      }
    };
  }

  /**
   * Validate session ID format
   */
  public static isValidSessionId(sessionId: string): boolean {
    return /^[a-zA-Z0-9_-]{8,64}$/.test(sessionId);
  }

  /**
   * Validate reputation score range
   */
  public static isValidScore(score: number): boolean {
    return Number.isFinite(score) && score >= 0 && score <= 100;
  }

  /**
   * Validate risk level
   */
  public static isValidRiskLevel(riskLevel: string): boolean {
    const validLevels = ['low', 'medium', 'high', 'critical'];
    return validLevels.includes(riskLevel.toLowerCase());
  }

  /**
   * Validate transaction hash format
   */
  public static isValidTransactionHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  /**
   * Validate block number
   */
  public static isValidBlockNumber(blockNumber: number | string): boolean {
    const num = typeof blockNumber === 'string' ? parseInt(blockNumber) : blockNumber;
    return Number.isInteger(num) && num >= 0;
  }

  /**
   * Validate feature vector
   */
  public static isValidFeatureVector(features: any): boolean {
    if (!features || typeof features !== 'object') return false;

    const requiredFields = [
      'transactionCount', 'transactionsPerDay', 'avgTransactionValue',
      'maxTransactionValue', 'minTransactionValue', 'accountAgeDays'
    ];

    return requiredFields.every(field => 
      field in features && typeof features[field] === 'number'
    );
  }

  /**
   * Sanitize string input
   */
  public static sanitizeString(input: string): string {
    if (!input) return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove HTML tags
      .substring(0, 1000); // Limit length
  }

  /**
   * Sanitize object for logging (remove sensitive data)
   */
  public static sanitizeForLogging(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveFields = [
      'privateKey', 'password', 'secret', 'token', 
      'authorization', 'cookie', 'signature'
    ];

    const sanitized = { ...obj };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Validate batch request size
   */
  public static validateBatchSize(items: any[], maxSize: number = 100): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(items)) {
      errors.push('Batch must be an array');
    } else if (items.length > maxSize) {
      errors.push(`Batch size exceeds maximum of ${maxSize}`);
    } else if (items.length === 0) {
      errors.push('Batch cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and parse numeric input
   */
  public static validateNumber(input: any, min?: number, max?: number): ValidationResult<number> {
    const errors: string[] = [];
    let value: number;

    if (input === undefined || input === null) {
      errors.push('Number is required');
      return { isValid: false, errors };
    }

    value = typeof input === 'string' ? parseFloat(input) : Number(input);

    if (!Number.isFinite(value)) {
      errors.push('Invalid number format');
    }

    if (min !== undefined && value < min) {
      errors.push(`Number must be at least ${min}`);
    }

    if (max !== undefined && value > max) {
      errors.push(`Number must be at most ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized: value
    };
  }
}

// Export utility functions
export const {
  isValidEthereumAddress,
  validateWalletRequest,
  isValidSessionId,
  isValidScore,
  isValidRiskLevel,
  isValidTransactionHash,
  isValidBlockNumber,
  isValidFeatureVector,
  sanitizeString,
  sanitizeForLogging,
  validateBatchSize,
  validateNumber
} = Validators;