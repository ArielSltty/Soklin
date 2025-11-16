/**
 * General Utility Functions
 * Common helper functions used across the application
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logging';

export class Helpers {
  /**
   * Load JSON file with error handling
   */
  public static async loadJSONFile<T>(filePath: string): Promise<T> {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      const data = await fs.readFile(absolutePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Failed to load JSON file: ${filePath}`, error);
      throw new Error(`Could not load file: ${filePath}`);
    }
  }

  /**
   * Save JSON file with error handling
   */
  public static async saveJSONFile(filePath: string, data: any): Promise<void> {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      const dir = path.dirname(absolutePath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(absolutePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to save JSON file: ${filePath}`, error);
      throw new Error(`Could not save file: ${filePath}`);
    }
  }

  /**
   * Delay execution for specified milliseconds
   */
  public static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique ID
   */
  public static generateUniqueId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Calculate exponential backoff delay
   */
  public static exponentialBackoff(
    attempt: number, 
    baseDelay: number = 1000, 
    maxDelay: number = 30000
  ): number {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Retry function with exponential backoff
   */
  public static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt} failed:`, error);

        if (attempt < maxAttempts) {
          const delay = this.exponentialBackoff(attempt, baseDelay);
          logger.debug(`Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Convert object to query string
   */
  public static toQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    }

    return searchParams.toString();
  }

  /**
   * Deep clone object
   */
  public static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Check if object is empty
   */
  public static isEmpty(obj: any): boolean {
    if (obj == null) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * Format bytes to human readable string
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration in milliseconds to human readable string
   */
  public static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Generate random number in range
   */
  public static randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate random integer in range
   */
  public static randomIntInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Check if running in development mode
   */
  public static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in production mode
   */
  public static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Get current timestamp in seconds
   */
  public static currentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Validate and parse environment variable
   */
  public static getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    
    if (!value && defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    
    return value || defaultValue!;
  }

  /**
   * Parse boolean from environment variable
   */
  public static getBoolEnvVar(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    
    if (!value) return defaultValue;
    
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Parse number from environment variable
   */
  public static getNumberEnvVar(key: string, defaultValue: number): number {
    const value = process.env[key];
    
    if (!value) return defaultValue;
    
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }
  
  /**
   * Generate random hash for mock transactions
   */
  public static generateRandomHash(): string {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Generate random Ethereum address for mock purposes
   */
  public static generateRandomAddress(): string {
    return '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

// Export utility functions
export const {
  loadJSONFile,
  saveJSONFile,
  delay,
  generateUniqueId,
  exponentialBackoff,
  retry,
  toQueryString,
  deepClone,
  isEmpty,
  formatBytes,
  formatDuration,
  randomInRange,
  randomIntInRange,
  isDevelopment,
  isProduction,
  currentTimestamp,
  getEnvVar,
  getBoolEnvVar,
  getNumberEnvVar,
  generateRandomHash,
  generateRandomAddress
} = Helpers;