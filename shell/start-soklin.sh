#!/bin/bash

# Soklin - Blockchain Analytics Platform
# Startup Script with Dependency Checks

set -e  # Exit on any error

echo "🚀 Starting Soklin - Blockchain Analytics Platform"

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
        echo "⚠️  ONNX model file not found at ml-models/wallet_fraud_model.onnx"
        echo "💡 Creating a placeholder model file (you'll need to train the actual model)"
        mkdir -p /home/siletty/Soklin/ml-models
        touch /home/siletty/Soklin/ml-models/wallet_fraud_model.onnx
    fi
    
    # Check if scaler file exists
    if [ ! -f "/home/siletty/Soklin/ml-models/scaler.pkl" ]; then
        echo "⚠️  Scaler file not found at ml-models/scaler.pkl"
        echo "💡 Creating a placeholder scaler file"
        touch /home/siletty/Soklin/ml-models/scaler.pkl
    fi
    
    # Check if blacklist file exists
    if [ ! -f "/home/siletty/Soklin/ml-models/blacklist.json" ]; then
        echo "⚠️  Blacklist file not found at ml-models/blacklist.json"
        echo "💡 Creating default blacklist file"
        echo "[]" > /home/siletty/Soklin/ml-models/blacklist.json
    fi

    echo "✅ All required files are present"
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
    
    # Create .env files if they don't exist
    if [ ! -f "/home/siletty/Soklin/backend/.env" ]; then
        echo "📝 Creating backend .env file from example"
        cp /home/siletty/Soklin/backend/.env.example /home/siletty/Soklin/backend/.env
    fi
    
    if [ ! -f "/home/siletty/Soklin/frontend/.env" ]; then
        echo "📝 Creating frontend .env file from example"
        cp /home/siletty/Soklin/frontend/.env /home/siletty/Soklin/backend/.env
    fi

    echo "✅ Environment setup complete"
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

# Function to start backend
start_backend() {
    echo "⚙️  Starting Backend Server..."
    
    # Check if backend port is available
    check_port 8000
    
    cd /home/siletty/Soklin/backend
    
    # Install dependencies if not already installed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    fi
    
    # Start the backend server in background
    nohup npm run dev > /home/siletty/Soklin/backend/logs/backend.log 2>&1 &
    BACKEND_PID=$!
    
    echo "⚙️  Backend server started with PID: $BACKEND_PID"
    echo "⚙️  Backend API available at: http://localhost:8000"
}

# Function to start ML model services (if they exist)
start_ml_services() {
    echo "🧠 Starting ML Model Services..."
    
    # Add any ML model services startup commands here
    echo "🧠 ML models services started"
}

# Function to display startup information
show_startup_info() {
    echo ""
    echo "🎉 Soklin is now running!"
    echo "🌐 Frontend: http://localhost:3000"
    echo "⚙️  Backend: http://localhost:8000"
    echo ""
    echo "💡 Tip: Use 'tail -f /home/siletty/Soklin/frontend/logs/frontend.log' to monitor frontend logs"
    echo "💡 Tip: Use 'tail -f /home/siletty/Soklin/backend/logs/backend.log' to monitor backend logs"
    echo ""
    echo "📋 To stop services, run: pkill -f 'npm run dev' or kill the process PIDs shown above"
}

# Main script logic
echo "🔍 Checking system dependencies..."
check_node
check_dependencies
setup_environment

# Create logs directories if they don't exist
mkdir -p /home/siletty/Soklin/frontend/logs
mkdir -p /home/siletty/Soklin/backend/logs

echo "⚡ Starting ALL Soklin services..."

# Start backend first
start_backend

# Small delay to ensure backend is ready
sleep 3

# Then start frontend
start_frontend

# Start ML services if needed
start_ml_services

show_startup_info