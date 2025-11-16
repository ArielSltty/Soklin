#!/bin/bash

# Soklin - Blockchain Analytics Platform
# Startup Script

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
    check_port 8080
    
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
    echo "⚙️  Backend API available at: http://localhost:8080"
}

# Function to start ML model services (if they exist)
start_ml_services() {
    echo "🧠 Starting ML Model Services..."
    
    # Add any ML model services startup commands here
    echo "🧠 ML models services started"
}

# Function to display usage information
show_usage() {
    echo "Usage: $0 [start|stop|restart|status]"
    echo ""
    echo "Commands:"
    echo "  start    - Start all Soklin services"
    echo "  stop     - Stop all Soklin services"
    echo "  restart  - Restart all Soklin services"
    echo "  status   - Show status of Soklin services"
    echo ""
    echo "Example: $0 start"
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping Soklin services..."
    
    # Kill frontend process
    FRONTEND_PIDS=$(lsof -ti:3000)
    if [ ! -z "$FRONTEND_PIDS" ]; then
        kill -9 $FRONTEND_PIDS 2>/dev/null || true
        echo "🛑 Stopped frontend processes: $FRONTEND_PIDS"
    fi
    
    # Kill backend process
    BACKEND_PIDS=$(lsof -ti:8080)
    if [ ! -z "$BACKEND_PIDS" ]; then
        kill -9 $BACKEND_PIDS 2>/dev/null || true
        echo "🛑 Stopped backend processes: $BACKEND_PIDS"
    fi
    
    echo "🛑 All Soklin services stopped"
}

# Function to show status
show_status() {
    echo "📊 Soklin Service Status:"
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null; then
        echo "🌐 Frontend: RUNNING (Port 3000)"
    else
        echo "🌐 Frontend: STOPPED"
    fi
    
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null; then
        echo "⚙️  Backend: RUNNING (Port 8080)"
    else
        echo "⚙️  Backend: STOPPED"
    fi
}

# Main script logic
case "${1:-start}" in
    start)
        echo "⚡ Starting ALL Soklin services..."
        
        # Create logs directories if they don't exist
        mkdir -p /home/siletty/Soklin/frontend/logs
        mkdir -p /home/siletty/Soklin/backend/logs
        
        # Start backend first
        start_backend
        
        # Small delay to ensure backend is ready
        sleep 3
        
        # Then start frontend
        start_frontend
        
        # Start ML services if needed
        start_ml_services
        
        echo ""
        echo "🎉 Soklin is now running!"
        echo "🌐 Frontend: http://localhost:3000"
        echo "⚙️  Backend: http://localhost:8080"
        echo ""
        echo "💡 Tip: Use 'tail -f /home/siletty/Soklin/frontend/logs/frontend.log' to monitor frontend logs"
        echo "💡 Tip: Use 'tail -f /home/siletty/Soklin/backend/logs/backend.log' to monitor backend logs"
        ;;
    
    stop)
        stop_services
        ;;
    
    restart)
        stop_services
        sleep 2
        $0 start
        ;;
    
    status)
        show_status
        ;;
    
    *)
        show_usage
        exit 1
        ;;
esac