import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Zap, Eye, Users, TrendingUp, Activity, ArrowRight, Target, AlertTriangle, Globe } from 'lucide-react';

const LandingPage = ({ onStartMonitoring }) => {
  const navigate = useNavigate();

  const handleStartClick = () => {
    if (onStartMonitoring) {
      onStartMonitoring();
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <img
                  src="/logo.png"
                  alt="Soklin Logo"
                  className="w-10 h-10 rounded-xl object-contain"
                  onError={(e) => {
                    // If logo.png doesn't exist, show fallback
                    e.target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center';
                    fallback.innerHTML = '<span class="text-white font-bold text-lg">S</span>';
                    e.target.parentNode.replaceChild(fallback, e.target);
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Soklin</h1>
                <p className="text-xs text-gray-600">Blockchain Security Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="#features"
                className="text-gray-700 hover:text-blue-600 transition-colors duration-200 text-sm font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Features
              </a>
              <a
                href="#about"
                className="text-gray-700 hover:text-blue-600 transition-colors duration-200 text-sm font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                About
              </a>
              <button
                onClick={handleStartClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Advanced Blockchain
              <span className="text-blue-600 block">Security & Monitoring</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Real-time wallet reputation analysis, transaction monitoring, and fraud detection powered by machine learning and Somnia Data Streams.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onStartMonitoring}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <span>Analyze Wallet</span>
                <ArrowRight size={20} />
              </button>
              <Link
                to="#features"
                className="border-2 border-gray-300 hover:border-blue-500 text-gray-700 hover:text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Powerful Security Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Comprehensive blockchain security monitoring with real-time analysis and community collaboration
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card p-6 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield size={24} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Monitoring</h3>
              <p className="text-gray-600">
                Continuous wallet surveillance with instant alerts for suspicious activities
              </p>
            </div>

            <div className="card p-6 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap size={24} className="text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Scoring</h3>
              <p className="text-gray-600">
                Machine learning algorithms for accurate risk assessment and reputation scoring
              </p>
            </div>

            <div className="card p-6 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Eye size={24} className="text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Transaction Analysis</h3>
              <p className="text-gray-600">
                Deep analysis of transaction patterns and behavioral anomalies
              </p>
            </div>

            <div className="card p-6 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Community Collaboration</h3>
              <p className="text-gray-600">
                Share insights and collaborate with other security professionals
              </p>
            </div>

            <div className="card p-6 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Automated Flagging</h3>
              <p className="text-gray-600">
                Automatic blockchain-based flagging of high-risk wallets
              </p>
            </div>

            <div className="card p-6 text-center hover:shadow-lg transition-shadow duration-200">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Globe size={24} className="text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Chain Support</h3>
              <p className="text-gray-600">
                Monitor multiple blockchain networks simultaneously
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div id="about" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">About Soklin</h2>
            <p className="text-gray-600 max-w-3xl mx-auto text-lg">
              Soklin is a cutting-edge blockchain security platform designed to protect users and projects in the decentralized ecosystem.
              By leveraging Somnia Data Streams and advanced machine learning algorithms, we provide real-time monitoring and analysis
              to identify potential threats and suspicious activities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Advanced Threat Detection</h3>
              <p className="text-gray-600 mb-4">
                Our ML-powered algorithms analyze transaction patterns, wallet behavior, and network activities to detect anomalies
                that could indicate fraudulent or malicious activities.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Real-time Intelligence</h3>
              <p className="text-gray-600 mb-4">
                Using Somnia Data Streams, we provide live updates and alerts, ensuring you never miss important wallet activities or
                potential security threats in the blockchain ecosystem.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Community-Driven Security</h3>
              <p className="text-gray-600">
                Our platform enables security professionals and blockchain users to collaborate, share insights, and collectively
                improve the security of the entire ecosystem.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-gray-200">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Precision Monitoring</h4>
                    <p className="text-gray-600 text-sm">Accurate detection with minimal false positives</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="text-green-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Lightning Fast</h4>
                    <p className="text-gray-600 text-sm">Real-time analysis and response capabilities</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="text-purple-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Trusted Security</h4>
                    <p className="text-gray-600 text-sm">Blockchain-verified reputation and flagging</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">10,000+</div>
              <div className="text-gray-600">Wallets Monitored</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">99.9%</div>
              <div className="text-gray-600">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">1M+</div>
              <div className="text-gray-600">Transactions Analyzed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-600 mb-2">24/7</div>
              <div className="text-gray-600">Real-time Monitoring</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Secure Your Blockchain Operations Today
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join thousands of security professionals protecting the blockchain ecosystem with advanced monitoring and analysis tools.
          </p>
          <button
            onClick={onStartMonitoring}
            className="bg-white text-blue-600 hover:bg-gray-50 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Start Free Analysis
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="relative w-8 h-8">
                <img
                  src="/logo.png"
                  alt="Soklin Logo"
                  className="w-8 h-8 rounded-lg object-contain"
                  onError={(e) => {
                    // If logo.png doesn't exist, show fallback
                    e.target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center';
                    fallback.innerHTML = '<span class="text-white font-bold text-sm">S</span>';
                    e.target.parentNode.replaceChild(fallback, e.target);
                  }}
                />
              </div>
              <span className="text-lg font-semibold text-gray-900">Soklin</span>
            </div>
            <div className="text-gray-600 text-sm">
              © 2025 Soklin Security Platform. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;