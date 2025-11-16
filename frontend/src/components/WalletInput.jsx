import React, { useState, useEffect } from 'react';
import { Search, X, AlertCircle, CheckCircle2, Copy, Zap, Shield, Target } from 'lucide-react';
import { formatWalletAddress } from '../utils/formatters';

const WalletInput = ({
  onWalletSubmit,
  onWalletUnsubscribe,
  currentWallet,
  isLoading,
  error,
  isSubscribed
}) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [localError, setLocalError] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);

  useEffect(() => {
    if (currentWallet) {
      setWalletAddress(currentWallet);
    }
  }, [currentWallet]);

  const validateWalletAddress = (address) => {
    if (!address) {
      setIsValidAddress(false);
      setLocalError('');
      return false;
    }

    // Basic Ethereum address validation
    const isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
    setIsValidAddress(isValid);

    if (!isValid && address.length > 0) {
      setLocalError('Please enter a valid Ethereum wallet address');
    } else {
      setLocalError('');
    }

    return isValid;
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setWalletAddress(value);
    validateWalletAddress(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!walletAddress) {
      setLocalError('Please enter a wallet address');
      return;
    }

    if (!isValidAddress) {
      setLocalError('Please enter a valid Ethereum wallet address');
      return;
    }

    const result = await onWalletSubmit(walletAddress);
    if (!result.success) {
      setLocalError(result.error || 'Failed to subscribe to wallet');
    }
  };

  const handleUnsubscribe = () => {
    onWalletUnsubscribe();
    setWalletAddress('');
    setLocalError('');
    setIsValidAddress(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setWalletAddress(text);
      validateWalletAddress(text);
    } catch (err) {
      setLocalError('Failed to read from clipboard');
    }
  };

  const handleClear = () => {
    setWalletAddress('');
    setLocalError('');
    setIsValidAddress(false);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Wallet Analysis</h2>
          <p className="text-gray-600">Enter an Ethereum-compatible wallet address to analyze its reputation and transaction patterns</p>
        </div>
        {isSubscribed && currentWallet && (
          <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-lg border border-green-200">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="text-green-700 font-medium">Monitoring: {formatWalletAddress(currentWallet)}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={walletAddress}
                onChange={handleInputChange}
                placeholder="Enter wallet address (0x...)"
                className={`
                  w-full pl-12 pr-12 py-3 border rounded-lg text-gray-900 placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  transition-all duration-300
                  ${localError || error ? 'border-red-500' : 'border-gray-300'}
                  ${isValidAddress && !localError ? 'border-green-500' : ''}
                `}
                disabled={isLoading || isSubscribed}
              />

              {walletAddress && !isSubscribed && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
                  disabled={isLoading || isSubscribed}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {!isSubscribed ? (
              <button
                type="submit"
                disabled={!isValidAddress || isLoading}
                className={`
                  px-6 py-3 rounded-lg font-medium transition-all duration-300 btn btn-primary
                  ${isValidAddress && !isLoading
                    ? ''
                    : 'opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  'Start Analysis'
                )}
              </button>
            ) : (
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    onWalletUnsubscribe();
                    setWalletAddress('');
                    setLocalError('');
                    setIsValidAddress(false);
                  }}
                  disabled={isLoading}
                  className="px-4 py-3 btn btn-primary"
                >
                  Switch Address
                </button>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={isLoading}
                  className="px-4 py-3 btn btn-danger"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Stopping...</span>
                    </div>
                  ) : (
                    'Stop Analysis'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!isSubscribed && (
            <div className="flex justify-between items-center mt-3">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="text-gray-600 hover:text-gray-800 text-sm transition-colors flex items-center space-x-1 group"
                >
                  <Copy size={14} className="group-hover:text-gray-800" />
                  <span>Paste from clipboard</span>
                </button>

              </div>

              <div className="flex items-center space-x-2">
                {walletAddress.length > 0 && (
                  <span className={`text-sm ${isValidAddress ? 'text-green-600' : 'text-red-600'}`}>
                    {isValidAddress ? '✅ Valid address' : '❌ Invalid address'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {(localError || error) && (
          <div className="flex items-center space-x-3 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={20} />
            <span className="text-sm">{localError || error}</span>
          </div>
        )}

        {/* Help Text */}
        {!walletAddress && !localError && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-sm">
              Soklin provides real-time wallet reputation analysis using advanced machine learning algorithms to assess risk profiles and identify suspicious activities.
              Enter any Ethereum-compatible wallet address to begin monitoring.
            </p>
          </div>
        )}
      </form>

      {/* Key Features */}
      {!currentWallet && !walletAddress && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="text-blue-600" size={20} />
              </div>
              <h4 className="font-semibold text-gray-900">Real-time Analysis</h4>
            </div>
            <p className="text-gray-600 text-sm">Instant reputation scoring with continuous transaction monitoring</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="text-green-600" size={20} />
              </div>
              <h4 className="font-semibold text-gray-900">Risk Assessment</h4>
            </div>
            <p className="text-gray-600 text-sm">Comprehensive threat evaluation using ML-powered algorithms</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="text-purple-600" size={20} />
              </div>
              <h4 className="font-semibold text-gray-900">Pattern Recognition</h4>
            </div>
            <p className="text-gray-600 text-sm">Advanced behavioral analysis to identify unusual activities</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletInput;