/**
 * API Endpoints Configuration
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

export const ENDPOINTS = {
  // Wallet endpoints
  WALLETS: {
    SUBSCRIBE: `${API_BASE}/wallets/subscribe`,
    UNSUBSCRIBE: `${API_BASE}/wallets/unsubscribe`,
    SCORE: (address) => `${API_BASE}/wallets/${address}/score`,
    FLAG_STATUS: (address) => `${API_BASE}/wallets/${address}/flag-status`,
    FLAG: (address) => `${API_BASE}/wallets/${address}/flag`,
    BATCH_SCORE: `${API_BASE}/wallets/batch-score`,
    ACTIVE: `${API_BASE}/wallets/active`
  },
  
  // System endpoints
  SYSTEM: {
    HEALTH: `${API_BASE}/system/health`,
    STATUS: `${API_BASE}/system/status`,
    METRICS: `${API_BASE}/system/metrics`,
    MODEL_INFO: `${API_BASE}/system/model-info`,
    BLOCKCHAIN_INFO: `${API_BASE}/system/blockchain-info`,
    WEBSOCKET_INFO: `${API_BASE}/system/websocket-info`,
    CONFIG: `${API_BASE}/system/config`
  }
};

// WebSocket configuration
export const WS_CONFIG = {
  URL: import.meta.env.VITE_WS_URL || 'http://localhost:8000',
  RECONNECT_ATTEMPTS: import.meta.env.VITE_WS_RECONNECT_ATTEMPTS || 10,
  RECONNECT_DELAY: import.meta.env.VITE_WS_RECONNECT_DELAY || 2000,
  RECONNECT_DELAY_MAX: import.meta.env.VITE_WS_RECONNECT_DELAY_MAX || 15000,
  TIMEOUT: import.meta.env.VITE_WS_TIMEOUT || 30000 // 30 seconds
};

export default ENDPOINTS;