/**
 * System API Controller
 * Handles system health, status, and utility endpoints
 */

import { Router, Request, Response } from 'express';
import { logger } from '../config/logging';
import { walletMonitorService } from '../services/walletMonitorService';
import { somniaService } from '../services/somniaService';
import { scoringService } from '../services/scoringService';
import { contractService } from '../services/contractService';
import { webSocketService } from '../services/websocketService';
import { blockchainConfig } from '../config/blockchain';
import { Helpers } from '../utils/helpers';
import { ApiResponse, SystemStatusResponse } from '../models/ApiModels';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    // Check all services health
    const walletMonitorHealth = walletMonitorService.healthCheck();
    const somniaHealth = somniaService.healthCheck();
    const scoringHealth = scoringService.healthCheck();
    const contractHealth = await contractService.healthCheck();
    const websocketHealth = webSocketService.healthCheck();
    const blockchainHealth = await blockchainConfig.healthCheck();

    // Determine overall health
    const allHealthy = 
      walletMonitorHealth.healthy &&
      somniaHealth.healthy &&
      scoringHealth.healthy &&
      contractHealth.healthy &&
      websocketHealth.healthy &&
      blockchainHealth.healthy;

    const status: SystemStatusResponse = {
      status: allHealthy ? 'healthy' : 'degraded',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        blockchain: blockchainHealth.healthy,
        mlModel: scoringHealth.healthy,
        database: true, // Add if you have a database
        websocket: websocketHealth.healthy
      },
      metrics: {
        activeConnections: websocketHealth.details.totalConnections,
        monitoredWallets: walletMonitorHealth.details.totalMonitored,
        totalTransactions: walletMonitorHealth.details.totalEvents,
        averageScore: 75 // This would be calculated from actual data
      }
    };

    const response: ApiResponse<SystemStatusResponse> = {
      success: true,
      data: status,
      requestId,
      timestamp: Date.now()
    };

    if (!allHealthy) {
      response.message = 'Some services are not healthy';
    }

    res.status(allHealthy ? 200 : 503).json(response);

  } catch (error) {
    logger.error('❌ Health check error:', error, { requestId });
    
    const errorResponse: ApiResponse<SystemStatusResponse> = {
      success: false,
      error: 'Health check failed',
      data: {
        status: 'unhealthy',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
          blockchain: false,
          mlModel: false,
          database: false,
          websocket: false
        },
        metrics: {
          activeConnections: 0,
          monitoredWallets: 0,
          totalTransactions: 0,
          averageScore: 0
        }
      },
      requestId,
      timestamp: Date.now()
    };

    res.status(503).json(errorResponse);
  }
});

/**
 * System status with detailed information
 */
router.get('/status', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    // Get detailed status from all services
    const walletMonitorStatus = walletMonitorService.healthCheck();
    const somniaStatus = somniaService.healthCheck();
    const scoringStatus = scoringService.healthCheck();
    const contractStatus = await contractService.healthCheck();
    const websocketStatus = webSocketService.healthCheck();
    const blockchainStatus = await blockchainConfig.healthCheck();
    const networkInfo = await contractService.getNetworkInfo();
    const monitoringStats = walletMonitorService.getMonitoringStats();
    const connectionStats = webSocketService.getConnectionStats();

    const response: ApiResponse<{
      services: any;
      blockchain: any;
      monitoring: any;
      websocket: any;
      system: any;
    }> = {
      success: true,
      data: {
        services: {
          walletMonitor: walletMonitorStatus,
          somnia: somniaStatus,
          scoring: scoringStatus,
          contract: contractStatus,
          websocket: websocketStatus,
          blockchain: blockchainStatus
        },
        blockchain: networkInfo,
        monitoring: monitoringStats,
        websocket: connectionStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: '1.0.0',
          nodeVersion: process.version,
          platform: process.platform
        }
      },
      requestId,
      timestamp: Date.now()
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ System status error:', error, { requestId });
    
    const errorResponse: ApiResponse<any> = {
      success: false,
      error: 'Failed to get system status',
      requestId,
      timestamp: Date.now()
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * Metrics endpoint (for Prometheus or other monitoring)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const monitoringStats = walletMonitorService.getMonitoringStats();
    const connectionStats = webSocketService.getConnectionStats();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Format metrics in Prometheus format
    const metrics = [
      '# HELP soklin_monitored_wallets_total Total number of monitored wallets',
      '# TYPE soklin_monitored_wallets_total gauge',
      `soklin_monitored_wallets_total ${monitoringStats.totalMonitored}`,

      '# HELP soklin_active_wallets_total Number of actively monitored wallets',
      '# TYPE soklin_active_wallets_total gauge',
      `soklin_active_wallets_total ${monitoringStats.activeMonitored}`,

      '# HELP soklin_processed_events_total Total number of processed events',
      '# TYPE soklin_processed_events_total counter',
      `soklin_processed_events_total ${monitoringStats.totalEvents}`,

      '# HELP soklin_websocket_connections_total Current WebSocket connections',
      '# TYPE soklin_websocket_connections_total gauge',
      `soklin_websocket_connections_total ${connectionStats.totalConnections}`,

      '# HELP soklin_websocket_subscriptions_total Current WebSocket subscriptions',
      '# TYPE soklin_websocket_subscriptions_total gauge',
      `soklin_websocket_subscriptions_total ${connectionStats.totalSubscriptions}`,

      '# HELP soklin_memory_usage_bytes Memory usage in bytes',
      '# TYPE soklin_memory_usage_bytes gauge',
      `soklin_memory_usage_bytes{type="rss"} ${memoryUsage.rss}`,
      `soklin_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}`,
      `soklin_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}`,
      `soklin_memory_usage_bytes{type="external"} ${memoryUsage.external}`,

      '# HELP soklin_uptime_seconds Application uptime in seconds',
      '# TYPE soklin_uptime_seconds gauge',
      `soklin_uptime_seconds ${uptime}`,

      '# HELP soklin_blacklist_size_total Size of the blacklist',
      '# TYPE soklin_blacklist_size_total gauge',
      `soklin_blacklist_size_total ${scoringService.getBlacklistSize()}`
    ].join('\n');

    res.set('Content-Type', 'text/plain');
    res.status(200).send(metrics);

  } catch (error) {
    logger.error('❌ Metrics error:', error, { requestId });
    res.status(500).send('# ERROR Failed to collect metrics\n');
  }
});

/**
 * Get ML model information
 */
router.get('/model-info', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const modelMetadata = scoringService.getModelMetadata();
    const featureNames = scoringService.getFeatureNames();
    const blacklistSize = scoringService.getBlacklistSize();

    const response: ApiResponse<{
      model: any;
      features: string[];
      blacklist: {
        size: number;
      };
    }> = {
      success: true,
      data: {
        model: modelMetadata,
        features: featureNames,
        blacklist: {
          size: blacklistSize
        }
      },
      requestId,
      timestamp: Date.now()
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Model info error:', error, { requestId });
    
    const errorResponse: ApiResponse<any> = {
      success: false,
      error: 'Failed to get model information',
      requestId,
      timestamp: Date.now()
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * Get blockchain information
 */
router.get('/blockchain-info', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const networkInfo = await contractService.getNetworkInfo();
    const gasSettings = await blockchainConfig.getCurrentGasSettings();
    const flaggedCount = await contractService.getActiveFlaggedCount();

    const response: ApiResponse<{
      network: any;
      gas: any;
      contract: any;
    }> = {
      success: true,
      data: {
        network: networkInfo,
        gas: gasSettings,
        contract: {
          address: contractService.getContractAddress(),
          flaggedWallets: flaggedCount
        }
      },
      requestId,
      timestamp: Date.now()
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Blockchain info error:', error, { requestId });
    
    const errorResponse: ApiResponse<any> = {
      success: false,
      error: 'Failed to get blockchain information',
      requestId,
      timestamp: Date.now()
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * Get WebSocket connection information
 */
router.get('/websocket-info', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    const connectionStats = webSocketService.getConnectionStats();
    const health = webSocketService.healthCheck();

    const response: ApiResponse<{
      connections: any;
      health: any;
    }> = {
      success: true,
      data: {
        connections: connectionStats,
        health: health
      },
      requestId,
      timestamp: Date.now()
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ WebSocket info error:', error, { requestId });
    
    const errorResponse: ApiResponse<any> = {
      success: false,
      error: 'Failed to get WebSocket information',
      requestId,
      timestamp: Date.now()
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * System configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  const requestId = (req as any).id;

  try {
    // Return non-sensitive configuration
    const config = {
      server: {
        port: process.env.PORT || 8000,
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info'
      },
      blockchain: {
        network: process.env.SOMNIA_NETWORK || 'testnet',
        chainId: parseInt(process.env.SOMNIA_CHAIN_ID || '50312'),
        contractAddress: process.env.CONTRACT_ADDRESS
      },
      features: {
        autoFlagging: true,
        realTimeScoring: true,
        blacklistChecking: true
      },
      thresholds: {
        flagging: 40,
        scoreUpdate: 5
      }
    };

    const response: ApiResponse<any> = {
      success: true,
      data: config,
      requestId,
      timestamp: Date.now()
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('❌ Config error:', error, { requestId });
    
    const errorResponse: ApiResponse<any> = {
      success: false,
      error: 'Failed to get configuration',
      requestId,
      timestamp: Date.now()
    };

    res.status(500).json(errorResponse);
  }
});

export default router;