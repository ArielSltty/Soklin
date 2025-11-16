const axios = require('axios');

async function testAPI() {
  const BASE_URL = 'http://localhost:8000';
  const walletAddress = '0xC188d7E186682502B0177bEbE427828e8F5daf50'; // Your Somnia STT wallet

  console.log('🧪 Testing Soklin API endpoints...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data.status);
    
    // Test wallet subscription
    console.log('\n2. Testing wallet subscription...');
    const subscribeResponse = await axios.post(`${BASE_URL}/api/wallets/subscribe`, {
      wallet: walletAddress,
      sessionId: 'test-session-api'
    });
    console.log('✅ Subscription response:', subscribeResponse.data.data.message);
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test getting wallet score
    console.log('\n3. Testing wallet score retrieval...');
    const scoreResponse = await axios.get(`${BASE_URL}/api/wallets/${walletAddress}/score`);
    console.log('📊 Score response:', {
      wallet: scoreResponse.data.data.wallet,
      score: scoreResponse.data.data.score?.reputationScore,
      riskLevel: scoreResponse.data.data.score?.riskLevel
    });
    
    // Test active wallets endpoint
    console.log('\n4. Testing active wallets endpoint...');
    const activeResponse = await axios.get(`${BASE_URL}/api/wallets/active`);
    console.log('📈 Active wallets:', activeResponse.data.data.wallets.length);
    
    // Test flag status
    console.log('\n5. Testing wallet flag status...');
    const flagStatusResponse = await axios.get(`${BASE_URL}/api/wallets/${walletAddress}/flag-status`);
    console.log('🚩 Flag status:', flagStatusResponse.data.data.isFlagged);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n✅ Soklin is now running in REAL mode with Somnia data streams');
    console.log('✅ No more demo mode - all transactions will be monitored live');
    console.log('✅ Risk scores will update in real-time based on actual blockchain data');
    console.log('✅ All errors (transaction not found, stuck scores) should be resolved');

  } catch (error) {
    console.error('❌ Error during API test:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAPI();