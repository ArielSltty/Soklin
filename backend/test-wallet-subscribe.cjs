const { io } = require('socket.io-client');

// Test WebSocket connection with wallet subscription
const socket = io('http://localhost:8000', {
  transports: ['websocket'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Test subscribing to a wallet
  console.log('Attempting to subscribe to wallet...');
  socket.emit('subscribe', { 
    wallet: '0xC188d7E186682502B0177bEbE427828e8F5daf50',
    sessionId: 'test-session-123'
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('💥 WebSocket error:', error);
});

socket.on('heartbeat', (data) => {
  console.log('💓 Received heartbeat:', data.data.serverTime);
});

socket.on('subscribe', (data) => {
  console.log('✅ Subscription confirmation received:', data);
});

socket.on('score_update', (data) => {
  console.log('📊 Score update:', data);
});

socket.on('transaction_alert', (data) => {
  console.log('🔔 Transaction alert:', data);
});

socket.on('wallet_flagged', (data) => {
  console.log('🚩 Wallet flagged:', data);
});

socket.on('error', (data) => {
  console.error('❌ Service error:', data);
});

// Keep the script running for 30 seconds then exit
setTimeout(() => {
  console.log('Test completed, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 30000);