/**
 * WebSocket Service for real-time communication
 */

import { io } from 'socket.io-client';
import { WS_CONFIG } from '../config/endpoint';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.eventCallbacks = new Map();
  }

  connect() {
    if (this.socket) {
      // Close existing socket if it's not in a proper state
      if (this.socket.disconnected || !this.socket.connected) {
        this.socket.disconnect();
        this.socket = null;
      } else {
        return this.socket;
      }
    }

    this.socket = io(WS_CONFIG.URL, {
      reconnection: true,
      reconnectionAttempts: WS_CONFIG.RECONNECT_ATTEMPTS,
      reconnectionDelay: WS_CONFIG.RECONNECT_DELAY,
      reconnectionDelayMax: WS_CONFIG.RECONNECT_DELAY_MAX, // Use configurable max delay
      timeout: WS_CONFIG.TIMEOUT, // Use configurable timeout
      autoConnect: true,
      // Additional options to handle socket issues
      upgrade: true, // Enable upgrade to WebSocket after initial connection
      forceNew: true,
      rejectUnauthorized: false, // Handle self-signed certificates if needed
      agent: false, // Disable proxy agents that might cause timeout issues
      transports: ['websocket', 'polling'], // Support both WebSocket and polling
      // Enable exponential backoff
      randomizationFactor: 0.5, // Add some randomness to reconnection delays
      // Additional options for better stability
      rememberUpgrade: true,
      onlyBinaryUpgrades: false,
      withCredentials: true
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason);
      this.isConnected = false;

      // Only attempt reconnection if the disconnection wasn't intentional
      if (reason !== 'io client disconnect') {
        console.log('🔄 Connection lost, will try to reconnect automatically');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('💥 WebSocket connection error:', error);
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        description: error.description
      });

      // Check if the error is related to timeout or network issues
      if (error.message.includes('timeout') || error.message.includes('network')) {
        console.warn('Network timeout detected, will retry connection');
      } else if (error.message.includes('xhr') || error.message.includes('polling')) {
        console.warn('Transport error detected, using fallback methods');
      }

      this.reconnectAttempts++;
    });

    this.socket.on('connect_timeout', (timeoutError) => {
      console.error('⏰ WebSocket connection timeout:', timeoutError);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Reconnection attempt ${attempt}/${WS_CONFIG.RECONNECT_ATTEMPTS}`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔄 Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ WebSocket reconnection failed after', WS_CONFIG.RECONNECT_ATTEMPTS, 'attempts');
      this.isConnected = false;
    });

    // Add event listener for transport changes
    this.socket.on('upgrade', (transport) => {
      console.log('🔄 Transport upgraded:', transport.name);
    });

    this.socket.on('upgrade_error', (error) => {
      console.error('🔄 Transport upgrade error:', error);
    });

    // Handle custom events
    this.socket.on('score_update', (data) => {
      this.triggerCallbacks('score_update', data);
    });

    this.socket.on('transaction_alert', (data) => {
      this.triggerCallbacks('transaction_alert', data);
    });

    this.socket.on('wallet_flagged', (data) => {
      this.triggerCallbacks('wallet_flagged', data);
    });

    this.socket.on('error', (data) => {
      console.error('WebSocket service error:', data);
      this.triggerCallbacks('error', data);
    });

    this.socket.on('heartbeat', (data) => {
      this.triggerCallbacks('heartbeat', data);
    });
  }

  subscribeToWallet(walletAddress) {
    if (!this.isConnected) {
      console.warn('WebSocket not connected');
      return false;
    }

    this.socket.emit('subscribe', { wallet: walletAddress });
    return true;
  }

  unsubscribeFromWallet(walletAddress) {
    if (!this.isConnected) {
      return false;
    }

    this.socket.emit('unsubscribe', { wallet: walletAddress });
    return true;
  }

  on(event, callback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventCallbacks.has(event)) {
      this.eventCallbacks.get(event).delete(callback);
    }
  }

  triggerCallbacks(event, data) {
    if (this.eventCallbacks.has(event)) {
      this.eventCallbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
        this.eventCallbacks.clear();
        console.log('✅ WebSocket disconnected successfully');
      } catch (error) {
        console.error('Error during WebSocket disconnection:', error);
      }
    }
  }

  // Method to manually attempt reconnection
  async reconnect() {
    console.log('🔄 Attempting manual reconnection...');

    // Disconnect existing socket if present
    if (this.socket) {
      this.disconnect();
    }

    // Wait a bit before attempting to reconnect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reset connection state
    this.isConnected = false;
    this.reconnectAttempts = 0;

    // Attempt to reconnect
    this.connect();
  }

  // Enhanced reconnection method with multiple strategies
  async smartReconnect() {
    console.log('🔄 Attempting smart reconnection...');

    if (this.socket) {
      this.disconnect();
    }

    // Exponential backoff strategy
    const delay = Math.min(WS_CONFIG.RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts), WS_CONFIG.RECONNECT_DELAY_MAX);

    console.log(`⏱  Reconnection delay: ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    this.isConnected = false;
    this.reconnectAttempts = 0;

    this.connect();
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;