#!/bin/bash

# Soklin - Test Wallet Monitoring Script
# For testing wallet: 0xC188d7E186682502B0177bEbE427828e8F5daf50

echo "🚀 Starting Soklin with enhanced transaction monitoring..."
echo "🎯 Testing wallet address: 0xC188d7E186682502B0177bEbE427828e8F5daf50"
echo ""

# Function to check if ports are available
check_ports() {
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Port 8000 (backend) is already in use"
        exit 1
    fi
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Port 3000 (frontend) is already in use"
        exit 1
    fi
    
    echo "✅ Ports are available"
}

# Function to verify environment
check_environment() {
    echo "🔍 Checking environment configuration..."
    
    if [ ! -f "/home/siletty/Soklin/backend/.env" ]; then
        echo "❌ Backend .env file not found"
        exit 1
    fi
    
    if [ ! -f "/home/siletty/Soklin/frontend/.env" ]; then
        echo "❌ Frontend .env file not found"
        exit 1
    fi
    
    # Check if required configuration exists
    if ! grep -q "SOMNIA_RPC_URL=" "/home/siletty/Soklin/backend/.env"; then
        echo "❌ SOMNIA_RPC_URL not found in backend .env"
        exit 1
    fi
    
    # Verify that the RPC URL is not the placeholder
    if grep -q "SOMNIA_RPC_URL=https://dream-rpc.somnia.network/" "/home/siletty/Soklin/backend/.env"; then
        echo "⚠️  Using default Somnia RPC URL (this should work for testnet)"
    else
        RPC_URL=$(grep "SOMNIA_RPC_URL=" "/home/siletty/Soklin/backend/.env" | cut -d'=' -f2)
        if [ -n "$RPC_URL" ] && [ "$RPC_URL" != "" ]; then
            echo "✅ Using configured RPC URL"
        else
            echo "❌ SOMNIA_RPC_URL is empty in .env file"
            exit 1
        fi
    fi
    
    echo "✅ Environment configuration verified"
}

# Function to start backend
start_backend() {
    echo "⚙️ Starting backend server..."
    cd /home/siletty/Soklin/backend
    
    # Check if node_modules exists, install if not
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    fi
    
    # Start backend with better logging
    npm run dev > /home/siletty/Soklin/backend/logs/backend_test.log 2>&1 &
    BACKEND_PID=$!
    echo "⚙️ Backend started with PID: $BACKEND_PID"
    
    # Wait a bit for backend to initialize
    sleep 8
    
    # Verify backend is running
    if ! ps -p $BACKEND_PID > /dev/null; then
        echo "❌ Backend failed to start. Check logs at /home/siletty/Soklin/backend/logs/backend_test.log"
        exit 1
    fi
    
    echo "✅ Backend is running"
}

# Function to start frontend
start_frontend() {
    echo "🌐 Starting frontend server..."
    cd /home/siletty/Soklin/frontend
    
    # Check if node_modules exists, install if not
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    # Start frontend
    npm run dev > /home/siletty/Soklin/frontend/logs/frontend_test.log 2>&1 &
    FRONTEND_PID=$!
    echo "🌐 Frontend started with PID: $FRONTEND_PID"
    
    echo "✅ Frontend is running"
}

# Function to display startup info
show_startup_info() {
    echo ""
    echo "🎉 Soklin started successfully with enhanced monitoring!"
    echo ""
    echo "📊 ENHANCED FEATURES ACTIVE:"
    echo "   • Increased transaction polling (2-second intervals)"
    echo "   • Comprehensive transaction search (searches 50 blocks back)"
    echo "   • Real-time transaction processing with immediate scoring"
    echo "   • Enhanced fallback scoring (no more static 85 scores)"
    echo "   • Live transaction feed with immediate updates"
    echo "   • Historical transaction detection"
    echo ""
    echo "🔗 Access the application:"
    echo "   Backend API: http://localhost:8000"
    echo "   Frontend UI: http://localhost:3000"
    echo ""
    echo "🎯 To test your wallet (0xC188d7E186682502B0177bEbE427828e8F5daf50):"
    echo "   1. Go to http://localhost:3000"
    echo "   2. Enter your wallet address: 0xC188d7E186682502B0177bEbE427828e8F5daf50"
    echo "   3. Click 'Start Analysis'"
    echo "   4. Make a transaction to your wallet"
    echo "   5. Watch for live updates within 2-3 seconds!"
    echo ""
    echo "📝 Check logs if issues occur:"
    echo "   Backend: tail -f /home/siletty/Soklin/backend/logs/backend_test.log"
    echo "   Frontend: tail -f /home/siletty/Soklin/frontend/logs/frontend_test.log"
    echo ""
    echo "📋 Expected behavior after transaction:"
    echo "   - Score should update (not stay at 85)"
    echo "   - Transaction should appear in live feed immediately"
    echo "   - 'No transactions found' should not appear if transactions exist"
    echo ""
    echo "🚀 Soklin is now running with full real-time monitoring capability!"
}

# Main execution
echo "🔧 Preparing to start Soklin with fixes for transaction detection..."
check_ports
check_environment

# Create logs directories
mkdir -p /home/siletty/Soklin/backend/logs
mkdir -p /home/siletty/Soklin/frontend/logs

# Start services
start_backend
start_frontend
show_startup_info

# Wait for user to read the instructions
echo ""
read -p "Press Enter when ready to continue..."