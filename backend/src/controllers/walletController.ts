/**
 * Wallet API Controller
 * Handles wallet-related HTTP endpoints
 */

import { Router, Request, Response } from 'express';
import { logger } from '../config/logging';
import { walletMonitorService } from '../services/walletMonitorService';
import { contractService } from '../services/contractService';
import { scoringService } from '../services/scoringService';
import { Validators } from '../utils/validators';
import { Helpers } from '../utils/helpers';
import {
  SubscribeWalletRequest,
  UnsubscribeWalletRequest,
  WalletScoreRequest,
  BatchScoreRequest,
  ApiResponse,
  WalletScoreResponse,
  BatchScoreResponse,
  SubscriptionResponse,
  ErrorResponse
} from '../models/ApiModels';

const router = Router();

/**
 * Subscribe to wallet monitoring
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  const startTime = Date.now();

  try {
    const request: SubscribeWalletRequest = req.body;

    // Validate request
    const validation = Validators.validateWalletRequest(request);
    if (!validation.isValid) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', validation.errors.join(', '), requestId);
    }

    const normalizedRequest = validation.normalized!;

    logger.info('📥 Wallet subscription request', {
      requestId,
      wallet: normalizedRequest.wallet,
      sessionId: normalizedRequest.sessionId
    });

    // Start monitoring wallet
    const result = await walletMonitorService.startMonitoringWallet(
      normalizedRequest.wallet,
      {
        includeTransactions: normalizedRequest.includeTransactions ?? true,
        includeTokenTransfers: true,
        fromBlock: undefined // Use undefined to start from latest block
      }
    );

    const response: ApiResponse<SubscriptionResponse> = {
      success: result.success,
      data: {
        wallet: normalizedRequest.wallet,
        subscribed: result.success,
        message: result.message,
        monitoringStarted: result.success
      },
      requestId,
      timestamp: Date.now()
    };

    if (!result.success) {
      response.error = result.message;
    }

    logger.info('📤 Wallet subscription response', {
      requestId,
      wallet: normalizedRequest.wallet,
      success: result.success,
      processingTime: Date.now() - startTime
    });

    res.status(result.success ? 200 : 400).json(response);

  } catch (error) {
    logger.error('❌ Wallet subscription error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to subscribe to wallet', requestId);
  }
});

/**
 * Unsubscribe from wallet monitoring
 */
router.delete('/unsubscribe', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  const startTime = Date.now();

  try {
    const request: UnsubscribeWalletRequest = req.body;

    // Validate request
    if (!request.wallet) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Wallet address is required', requestId);
    }

    const validation = Validators.isValidEthereumAddress(request.wallet);
    if (!validation.isValid) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', validation.errors.join(', '), requestId);
    }

    const normalizedWallet = validation.normalized!;

    logger.info('📥 Wallet unsubscription request', {
      requestId,
      wallet: normalizedWallet,
      sessionId: request.sessionId
    });

    // Stop monitoring wallet
    const result = await walletMonitorService.stopMonitoringWallet(normalizedWallet);

    const response: ApiResponse<SubscriptionResponse> = {
      success: result.success,
      data: {
        wallet: normalizedWallet,
        subscribed: false,
        message: result.message
      },
      requestId,
      timestamp: Date.now()
    };

    if (!result.success) {
      response.error = result.message;
    }

    logger.info('📤 Wallet unsubscription response', {
      requestId,
      wallet: normalizedWallet,
      success: result.success,
      processingTime: Date.now() - startTime
    });

    res.status(result.success ? 200 : 400).json(response);

  } catch (error) {
    logger.error('❌ Wallet unsubscription error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to unsubscribe from wallet', requestId);
  }
});

/**
 * Get wallet score
 */
router.get('/:address/score', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  const startTime = Date.now();

  try {
    const walletAddress = req.params.address;
    const refresh = req.query.refresh === 'true';

    // Validate wallet address
    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', validation.errors.join(', '), requestId);
    }

    const normalizedWallet = validation.normalized!;

    logger.info('📥 Wallet score request', {
      requestId,
      wallet: normalizedWallet,
      refresh
    });

    // Get wallet status to check if monitored
    const walletStatus = walletMonitorService.getWalletStatus(normalizedWallet);
    
    let score;
    let cached = true;

    if (refresh || !walletStatus?.lastScore) {
      // Force recalculate score
      score = await walletMonitorService.recalculateScore(normalizedWallet);
      cached = false;
    } else {
      // Use cached score
      score = walletStatus.lastScore;
    }

    if (!score) {
      return sendErrorResponse(res, 404, 'SCORE_NOT_FOUND', 'Could not calculate wallet score', requestId);
    }

    const response: ApiResponse<WalletScoreResponse> = {
      success: true,
      data: {
        wallet: normalizedWallet,
        score,
        cached,
        processingTime: Date.now() - startTime
      },
      requestId,
      timestamp: Date.now()
    };

    logger.info('📤 Wallet score response', {
      requestId,
      wallet: normalizedWallet,
      score: score.reputationScore,
      riskLevel: score.riskLevel,
      cached,
      processingTime: Date.now() - startTime
    });

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Wallet score error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get wallet score', requestId);
  }
});

/**
 * Batch score multiple wallets
 */
router.post('/batch-score', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  const startTime = Date.now();

  try {
    const request: BatchScoreRequest = req.body;

    // Validate request
    if (!request.wallets || !Array.isArray(request.wallets)) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Wallets array is required', requestId);
    }

    const validation = Validators.validateBatchSize(request.wallets, 50);
    if (!validation.isValid) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', validation.errors.join(', '), requestId);
    }

    logger.info('📥 Batch score request', {
      requestId,
      walletCount: request.wallets.length
    });

    // Validate and normalize all wallet addresses
    const validWallets: string[] = [];
    const invalidWallets: string[] = [];

    request.wallets.forEach(wallet => {
      const validation = Validators.isValidEthereumAddress(wallet);
      if (validation.isValid && validation.normalized) {
        validWallets.push(validation.normalized);
      } else {
        invalidWallets.push(wallet);
      }
    });

    if (validWallets.length === 0) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'No valid wallet addresses provided', requestId);
    }

    // Start monitoring all valid wallets (they will be scored automatically)
    const batchResult = await walletMonitorService.batchStartMonitoring(validWallets);

    const scores: WalletScoreResponse[] = [];

    // Collect scores for successfully monitored wallets
    for (const wallet of batchResult.success) {
      const status = walletMonitorService.getWalletStatus(wallet);
      if (status?.lastScore) {
        scores.push({
          wallet,
          score: status.lastScore,
          cached: true,
          processingTime: 0
        });
      }
    }

    const response: ApiResponse<BatchScoreResponse> = {
      success: true,
      data: {
        scores,
        processed: scores.length,
        failed: batchResult.failed.length + invalidWallets.length
      },
      requestId,
      timestamp: Date.now()
    };

    if (invalidWallets.length > 0 || batchResult.failed.length > 0) {
      response.message = `Some wallets could not be processed. Invalid: ${invalidWallets.length}, Failed: ${batchResult.failed.length}`;
    }

    logger.info('📤 Batch score response', {
      requestId,
      processed: scores.length,
      failed: batchResult.failed.length + invalidWallets.length,
      processingTime: Date.now() - startTime
    });

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Batch score error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to process batch score request', requestId);
  }
});

/**
 * Get active monitored wallets
 */
router.get('/active', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const activeWallets = walletMonitorService.getActiveWallets();
    const stats = walletMonitorService.getMonitoringStats();

    const response: ApiResponse<{
      wallets: string[];
      statistics: any;
    }> = {
      success: true,
      data: {
        wallets: activeWallets,
        statistics: stats
      },
      requestId,
      timestamp: Date.now()
    };

    logger.debug('📤 Active wallets response', {
      requestId,
      walletCount: activeWallets.length
    });

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Active wallets error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get active wallets', requestId);
  }
});

/**
 * Get wallet flag status from contract
 */
router.get('/:address/flag-status', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const walletAddress = req.params.address;

    // Validate wallet address
    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', validation.errors.join(', '), requestId);
    }

    const normalizedWallet = validation.normalized!;

    // Check if wallet is flagged
    const isFlagged = await contractService.isWalletFlagged(normalizedWallet);
    const flagDetails = await contractService.getWalletFlag(normalizedWallet);

    const response: ApiResponse<{
      wallet: string;
      isFlagged: boolean;
      flagDetails: any;
    }> = {
      success: true,
      data: {
        wallet: normalizedWallet,
        isFlagged,
        flagDetails
      },
      requestId,
      timestamp: Date.now()
    };

    logger.debug('📤 Wallet flag status response', {
      requestId,
      wallet: normalizedWallet,
      isFlagged
    });

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Wallet flag status error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get wallet flag status', requestId);
  }
});

/**
 * Manually flag a wallet
 */
router.post('/:address/flag', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const walletAddress = req.params.address;
    const { riskLevel, reputationScore, reason } = req.body;

    // Validate wallet address
    const validation = Validators.isValidEthereumAddress(walletAddress);
    if (!validation.isValid) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', validation.errors.join(', '), requestId);
    }

    const normalizedWallet = validation.normalized!;

    // Validate required parameters
    if (!riskLevel || !reputationScore) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Risk level and reputation score are required', requestId);
    }

    if (!Validators.isValidRiskLevel(riskLevel)) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid risk level', requestId);
    }

    if (!Validators.isValidScore(reputationScore)) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid reputation score', requestId);
    }

    logger.info('🚩 Manual wallet flag request', {
      requestId,
      wallet: normalizedWallet,
      riskLevel,
      reputationScore
    });

    // Flag wallet on-chain
    const result = await contractService.flagWallet(
      normalizedWallet,
      riskLevel,
      reputationScore,
      reason || 'Manually flagged via API'
    );

    const response: ApiResponse<{
      success: boolean;
      transactionHash?: string;
    }> = {
      success: result.success,
      data: {
        success: result.success,
        transactionHash: result.transactionHash
      },
      requestId,
      timestamp: Date.now()
    };

    if (!result.success) {
      response.error = result.error;
    }

    logger.info('📤 Manual wallet flag response', {
      requestId,
      wallet: normalizedWallet,
      success: result.success,
      transactionHash: result.transactionHash
    });

    res.status(result.success ? 200 : 400).json(response);

  } catch (error) {
    logger.error('❌ Manual wallet flag error:', error, { requestId });
    sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to flag wallet', requestId);
  }
});

/**
 * Send error response
 */
function sendErrorResponse(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  requestId?: string,
  details?: any
): void {
  const errorResponse: ApiResponse<ErrorResponse> = {
    success: false,
    error: message,
    data: {
      code,
      message,
      details,
      requestId
    },
    requestId,
    timestamp: Date.now()
  };

  res.status(statusCode).json(errorResponse);
}

export default router;