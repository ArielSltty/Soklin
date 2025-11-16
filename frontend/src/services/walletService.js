/**
 * Wallet Service for API calls
 */

import axios from 'axios';
import { ENDPOINTS } from '../config/endpoint';

class WalletService {
  constructor() {
    this.api = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response.data,
      (error) => {
        console.error('API Error:', error);
        throw error;
      }
    );
  }

  async subscribeWallet(walletAddress, options = {}) {
    try {
      const response = await this.api.post(ENDPOINTS.WALLETS.SUBSCRIBE, {
        wallet: walletAddress,
        includeTransactions: options.includeTransactions ?? true,
        sessionId: options.sessionId
      });
      return response;
    } catch (error) {
      console.error('Subscribe wallet error:', error);
      throw error;
    }
  }

  async unsubscribeWallet(walletAddress, sessionId = null) {
    try {
      const response = await this.api.delete(ENDPOINTS.WALLETS.UNSUBSCRIBE, {
        data: {
          wallet: walletAddress,
          sessionId
        }
      });
      return response;
    } catch (error) {
      console.error('Unsubscribe wallet error:', error);
      throw error;
    }
  }

  async getWalletScore(walletAddress, refresh = false) {
    try {
      const response = await this.api.get(ENDPOINTS.WALLETS.SCORE(walletAddress), {
        params: { refresh }
      });
      return response;
    } catch (error) {
      console.error('Get wallet score error:', error);
      throw error;
    }
  }

  async getWalletFlagStatus(walletAddress) {
    try {
      const response = await this.api.get(ENDPOINTS.WALLETS.FLAG_STATUS(walletAddress));
      return response;
    } catch (error) {
      console.error('Get wallet flag status error:', error);
      throw error;
    }
  }

  async flagWallet(walletAddress, riskLevel, reputationScore, reason = '') {
    try {
      const response = await this.api.post(ENDPOINTS.WALLETS.FLAG(walletAddress), {
        riskLevel,
        reputationScore,
        reason
      });
      return response;
    } catch (error) {
      console.error('Flag wallet error:', error);
      throw error;
    }
  }

  async batchScoreWallets(walletAddresses) {
    try {
      const response = await this.api.post(ENDPOINTS.WALLETS.BATCH_SCORE, {
        wallets: walletAddresses
      });
      return response;
    } catch (error) {
      console.error('Batch score wallets error:', error);
      throw error;
    }
  }

  async getActiveWallets() {
    try {
      const response = await this.api.get(ENDPOINTS.WALLETS.ACTIVE);
      return response;
    } catch (error) {
      console.error('Get active wallets error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walletService = new WalletService();
export default walletService;