#!/bin/bash

# VedxBuilder Startup Script
echo "🚀 Starting VedxBuilder..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Kill existing processes on ports 3000 and 3001
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
if check_port 3000; then
    echo "Killing process on port 3000..."
    kill -9 $(lsof -ti:3000) 2>/dev/null || true
fi

if check_port 3001; then
    echo "Killing process on port 3001..."
    kill -9 $(lsof -ti:3001) 2>/dev/null || true
fi

# Start backend server
echo -e "${BLUE}Starting VedxBuilder Backend Server...${NC}"
cd server
npm start &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 3

# Check if backend started successfully
if check_port 3001; then
    echo -e "${GREEN}✓ Backend server started on port 3001${NC}"
else
    echo -e "${RED}✗ Failed to start backend server${NC}"
    exit 1
fi

# Start frontend
echo -e "${BLUE}Starting VedxBuilder Frontend...${NC}"
cd ..
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo "Waiting for frontend to initialize..."
sleep 5

# Check if frontend started successfully
if check_port 3000; then
    echo -e "${GREEN}✓ Frontend started on port 3000${NC}"
else
    echo -e "${RED}✗ Failed to start frontend${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 VedxBuilder is now running!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:3001"
echo -e "${BLUE}🔌 WebSocket:${NC} ws://localhost:3001"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down VedxBuilder...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✓ VedxBuilder stopped${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait