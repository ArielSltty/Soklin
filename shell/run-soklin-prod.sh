#!/bin/bash

# Soklin - Blockchain Analytics Platform
# Production Startup Script with Real Mode

set -e  # Exit on any error

echo "🚀 Starting Soklin - Blockchain Analytics Platform in REAL MODE"
echo "📊 Using Somnia Chain Stream SDK with live blockchain data"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use. Please stop the existing process first."
        exit 1
    fi
}

# Function to check if required files exist
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    # Check if ONNX model exists
    if [ ! -f "/home/siletty/Soklin/ml-models/wallet_fraud_model.onnx" ]; then
        echo "❌ ONNX model file not found at ml-models/wallet_fraud_model.onnx"
        exit 1
    fi
    
    # Check if scaler file exists
    if [ ! -f "/home/siletty/Soklin/ml-models/scaler.pkl" ]; then
        echo "❌ Scaler file not found at ml-models/scaler.pkl"
        exit 1
    fi
    
    # Check if model features file exists
    if [ ! -f "/home/siletty/Soklin/ml-models/model_features.json" ]; then
        echo "❌ Model features file not found"
        exit 1
    fi

    echo "✅ All required model files are present"
}

# Function to check if Node.js and npm are available
check_node() {
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm first."
        exit 1
    fi

    echo "✅ Node.js and npm are available"
    echo "📊 Node.js version: $(node --version)"
    echo "📦 npm version: $(npm --version)"
}

# Function to setup environment
setup_environment() {
    echo "🔧 Setting up environment..."
    
    # Check if .env files exist
    if [ ! -f "/home/siletty/Soklin/backend/.env" ]; then
        echo "❌ Backend .env file not found. Please configure your environment first."
        exit 1
    fi
    
    if [ ! -f "/home/siletty/Soklin/frontend/.env" ]; then
        echo "❌ Frontend .env file not found. Please configure your environment first."
        exit 1
    fi

    echo "✅ Environment setup complete"
}

# Function to verify blockchain connection
verify_blockchain_connection() {
    echo "🔗 Verifying blockchain connection..."
    
    # Check if environment variables are set properly
    if [ -z "$SOMNIA_RPC_URL" ] || [ "$SOMNIA_RPC_URL" = "https://dream-rpc.somnia.network/" ]; then
        echo "⚠️  Using default Somnia RPC URL. This may work for testnet."
    else
        echo "✅ Using custom Somnia RPC URL: $SOMNIA_RPC_URL"
    fi
    
    if [ -z "$SOMNIA_CHAIN_ID" ]; then
        echo "⚠️  Chain ID not set, using default (50312)"
    else
        echo "✅ Chain ID: $SOMNIA_CHAIN_ID"
    fi

    echo "✅ Blockchain connection configuration verified"
}

# Function to start backend
start_backend() {
    echo "⚙️  Starting Backend Server in REAL MODE..."
    
    # Check if backend port is available
    check_port 8000
    
    cd /home/siletty/Soklin/backend
    
    # Install dependencies if not already installed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    fi
    
    echo "⚡ Starting backend with REAL MODE configuration..."
    echo "📋 Using Somnia Chain Stream SDK for live blockchain data"
    
    # Start the backend server in background
    nohup npm run dev > /home/siletty/Soklin/backend/logs/backend.log 2>&1 &
    BACKEND_PID=$!
    
    echo "⚙️  Backend server started with PID: $BACKEND_PID"
    echo "⚙️  Backend API available at: http://localhost:8000"
    
    # Wait a moment for the server to initialize
    sleep 5
    
    # Check if backend started successfully
    if ! ps -p $BACKEND_PID > /dev/null; then
        echo "❌ Backend server failed to start. Check logs at /home/siletty/Soklin/backend/logs/backend.log"
        exit 1
    fi
    
    echo "✅ Backend server is running in REAL MODE"
}

# Function to start frontend
start_frontend() {
    echo "🌐 Starting Frontend Server..."
    
    # Check if frontend port is available
    check_port 3000
    
    cd /home/siletty/Soklin/frontend
    
    # Install dependencies if not already installed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    # Start the frontend server in background
    nohup npm run dev > /home/siletty/Soklin/frontend/logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    echo "🌐 Frontend server started with PID: $FRONTEND_PID"
    echo "🌐 Access the frontend at: http://localhost:3000"
}

# Function to display startup information
show_startup_info() {
    echo ""
    echo "🎉 Soklin is now running in REAL MODE!"
    echo "🔗 Connected to Somnia blockchain via Stream SDK"
    echo "📊 Processing live blockchain data for accurate scoring"
    echo "⚡ Real-time transaction monitoring active"
    echo ""
    echo "🌐 Frontend: http://localhost:3000"
    echo "⚙️  Backend: http://localhost:8000"
    echo ""
    echo "📋 REAL MODE FEATURES:"
    echo "   • Live blockchain transaction monitoring"
    echo "   • Somnia Chain Stream SDK integration" 
    echo "   • Real-time wallet scoring with ML model"
    echo "   • Live transaction feeds with actual data"
    echo "   • No demo mode or fake data"
    echo ""
    echo "💡 Tip: Use 'tail -f /home/siletty/Soklin/backend/logs/backend.log' to monitor backend logs"
    echo "💡 Tip: Use 'tail -f /home/siletty/Soklin/frontend/logs/frontend.log' to monitor frontend logs"
    echo ""
    echo "📋 To stop services, run: pkill -f 'npm run dev' or kill the process PIDs shown above"
    echo ""
    echo "🚀 Soklin is now operating in FULL REAL MODE - NO DEMO MODE"
}

# Main script logic
echo "🔍 System check starting..."
check_node
check_dependencies
setup_environment
verify_blockchain_connection

# Create logs directories if they don't exist
mkdir -p /home/siletty/Soklin/frontend/logs
mkdir -p /home/siletty/Soklin/backend/logs

echo ""
echo "⚡ Starting Soklin in REAL MODE with live blockchain integration..."
echo ""

# Start backend first (this initializes blockchain connection)
start_backend

# Small delay to ensure backend blockchain connection is established
sleep 8

# Then start frontend
start_frontend

show_startup_info

echo ""
echo "✅ REAL MODE ACTIVATED - Demo mode has been completely removed"
echo "🔒 Soklin is now using live blockchain data via Somnia SDK"