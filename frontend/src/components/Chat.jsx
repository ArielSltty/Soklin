import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users, Clock } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWalletContext } from '../contexts/WalletContext';

const Chat = ({ walletAddress }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const messagesEndRef = useRef(null);
  const { isConnected: wsConnected, onTransactionAlert, subscribeToWallet, unsubscribeFromWallet } = useWebSocket();
  const { blockchainStatus, connectBlockchain } = useWalletContext();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle incoming transaction alerts
  useEffect(() => {
    if (!walletAddress) return;

    const cleanup = onTransactionAlert((data) => {
      if (data.data.wallet === walletAddress) {
        const message = {
          id: Date.now() + Math.random(),
          text: `🚨 Transaction detected for ${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}: ${data.data.transaction.value} ETH`,
          sender: 'System',
          timestamp: new Date().toISOString(),
          type: 'system'
        };
        setMessages(prev => [...prev, message]);
      }
    });

    return () => cleanup && cleanup();
  }, [walletAddress, onTransactionAlert]);

  // Handle sending message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !wsConnected) return;

    const message = {
      id: Date.now() + Math.random(),
      text: newMessage,
      sender: 'You',
      timestamp: new Date().toISOString(),
      type: 'user',
      wallet: walletAddress
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // In a real implementation, this would send to the WebSocket
    console.log('Sending message to chat:', message);
  };

  // Add some sample messages for better UX
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 1,
          text: 'Welcome to the Soklin community chat! Discuss wallet monitoring and alerts here.',
          sender: 'System',
          timestamp: new Date().toISOString(),
          type: 'system'
        }
      ]);
    }
  }, []);

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageCircle size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Live Community Chat</h3>
            <p className="text-gray-600 text-sm">
              {wsConnected ? 'Connected' : 'Connecting...'} • {messages.length} messages
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">{wsConnected ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 max-h-64">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'system'
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-xs">
                    {message.sender}
                    {message.type === 'user' && message.wallet && (
                      <span className="text-xs opacity-75 ml-2">
                        ({message.wallet.substring(0, 6)}...{message.wallet.substring(38)})
                      </span>
                    )}
                  </span>
                  <span className="text-xs opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{message.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 input-field pr-12"
          disabled={!wsConnected}
        />
        <button
          type="submit"
          disabled={!wsConnected || !newMessage.trim()}
          className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Connection Status */}
      {!wsConnected && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-yellow-600" />
            <span className="text-yellow-800 text-sm">
              WebSocket connection is currently unavailable. Real-time updates will resume when connected.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;