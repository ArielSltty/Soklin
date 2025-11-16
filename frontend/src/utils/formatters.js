/**
 * Formatting utility functions
 */

/**
 * Format wallet address for display
 */
export const formatWalletAddress = (address, startLength = 6, endLength = 4) => {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
};

/**
 * Format large numbers
 */
export const formatNumber = (num, decimals = 2) => {
  if (!num && num !== 0) return 'N/A';
  
  const number = typeof num === 'string' ? parseFloat(num) : num;
  
  if (number === 0) return '0';
  if (Math.abs(number) < 0.0001) return '~0';
  
  if (Math.abs(number) >= 1000000) {
    return (number / 1000000).toFixed(decimals) + 'M';
  } else if (Math.abs(number) >= 1000) {
    return (number / 1000).toFixed(decimals) + 'K';
  } else {
    return number.toFixed(decimals);
  }
};

/**
 * Format ETH value
 */
export const formatETH = (value, decimals = 4) => {
  if (!value && value !== 0) return 'N/A';
  
  const ethValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${ethValue.toFixed(decimals)} ETH`;
};

/**
 * Format timestamp to readable date
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

/**
 * Get risk level color class
 */
export const getRiskColorClass = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return 'risk-low';
    case 'medium':
      return 'risk-medium';
    case 'high':
      return 'risk-high';
    case 'critical':
      return 'risk-critical';
    default:
      return 'risk-low';
  }
};

/**
 * Get risk level icon
 */
export const getRiskIcon = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return '🟢';
    case 'medium':
      return '🟡';
    case 'high':
      return '🟠';
    case 'critical':
      return '🔴';
    default:
      return '⚪';
  }
};

/**
 * Calculate score color based on value
 */
export const getScoreColor = (score) => {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 30) return 'text-orange-600';
  return 'text-red-600';
};

export default {
  formatWalletAddress,
  formatNumber,
  formatETH,
  formatTimestamp,
  getRiskColorClass,
  getRiskIcon,
  getScoreColor
};