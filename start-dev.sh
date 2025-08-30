#!/bin/bash

# VedxBuilder Development Startup Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════╗"
echo "║         VedxBuilder v1.0.0           ║"
echo "║    Production-Ready AI IDE Stack     ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if port is in use
check_port() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
    else
        netstat -tuln 2>/dev/null | grep ":$1 " >/dev/null 2>&1
    fi
}

# Function to kill process on port
kill_port() {
    if command -v lsof >/dev/null 2>&1; then
        local pids=$(lsof -ti:$1 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "Killing processes on port $1: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down VedxBuilder...${NC}"
    kill_port 3000
    kill_port 3001
    echo -e "${GREEN}✓ VedxBuilder stopped${NC}"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Step 1: Clean up existing processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
kill_port 3000
kill_port 3001
sleep 2

# Step 2: Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
    cd backend
    npm install
    cd ..
fi

# Step 3: Setup environment
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚙️  Setting up backend environment...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✓ Created backend/.env (add your OpenAI API key for real AI responses)${NC}"
fi

# Step 4: Start backend server
echo -e "${BLUE}🚀 Starting VedxBuilder Backend...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
for i in {1..15}; do
    if check_port 3001; then
        echo -e "${GREEN}✓ Backend server started on port 3001${NC}"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${RED}✗ Backend failed to start${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Step 5: Check backend health
echo "🔍 Checking backend health..."
if curl -s http://localhost:3001/healthz >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend health check passed${NC}"
else
    echo -e "${YELLOW}⚠ Backend health check failed (may still work)${NC}"
fi

# Step 6: Start frontend
echo -e "${BLUE}🎨 Starting VedxBuilder Frontend...${NC}"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to initialize..."
for i in {1..20}; do
    if check_port 3000; then
        echo -e "${GREEN}✓ Frontend started on port 3000${NC}"
        break
    fi
    if [ $i -eq 20 ]; then
        echo -e "${RED}✗ Frontend failed to start${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Success message
echo ""
echo -e "${GREEN}🎉 VedxBuilder is now running!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend (VedxBuilder IDE):${NC} http://localhost:3000"
echo -e "${BLUE}🔧 Backend API:${NC}               http://localhost:3001"
echo -e "${BLUE}📊 Health Check:${NC}             http://localhost:3001/healthz"
echo -e "${BLUE}🔌 WebSocket Events:${NC}         ws://localhost:3001/stream"
echo ""
echo -e "${PURPLE}Features Available:${NC}"
echo "  ✅ AI-powered code generation with structured plans"
echo "  ✅ Real-time WebSocket event streaming"
echo "  ✅ Atomic file operations with transaction rollback"
echo "  ✅ Integrated build system with Vite"
echo "  ✅ Plan review UI with diff viewer"
echo "  ✅ Comprehensive error handling and validation"
echo "  ✅ Production-ready architecture with security hooks"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "  • Add your OpenAI API key to backend/.env for real AI responses"
echo "  • Use the AI chat to generate code with detailed plans"
echo "  • Review plans before applying with the diff viewer"
echo "  • Monitor build status in the Codespace panel"
echo "  • Check logs in backend/logs/ for debugging"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running and wait for processes
wait