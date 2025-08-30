# VedxBuilder Setup Guide 🚀

## Quick Start (Recommended)

### Option 1: Auto Setup Script
```bash
./start-vedxbuilder.sh
```
This will automatically start both frontend and backend servers.

### Option 2: Manual Setup

1. **Start Backend Server**
   ```bash
   cd server
   npm install
   npm start
   ```
   Backend will run on: http://localhost:3001

2. **Start Frontend (New Terminal)**
   ```bash
   npm install
   npm run dev
   ```
   Frontend will run on: http://localhost:3000

## 🔧 Configuration

### Environment Variables (server/.env)
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# For Real AI Responses (Optional)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
```

### Adding Real AI Integration

1. **Get OpenAI API Key**
   - Visit: https://platform.openai.com/api-keys
   - Create new API key
   - Add to `server/.env` file

2. **Update Environment**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your API key
   ```

3. **Restart Backend**
   ```bash
   npm start
   ```

## 🌐 API Endpoints

- **Chat**: `POST /api/chat` - AI assistant messages
- **Terminal**: `POST /api/terminal/execute` - Command execution
- **Files**: `GET /api/files` - File system operations
- **Health**: `GET /api/health` - Service status
- **WebSocket**: `ws://localhost:3001` - Real-time features

## 🎯 Features Available

### ✅ **Currently Working**
- ✅ Full UI interface (Cursor-like)
- ✅ Real backend API integration
- ✅ WebSocket real-time communication
- ✅ Enhanced AI responses (local simulation)
- ✅ Terminal command execution
- ✅ File system operations
- ✅ Connection status indicators

### 🔄 **With OpenAI API Key**
- 🤖 Real GPT-powered responses
- 🧠 Context-aware conversations
- 📝 Advanced code generation
- 🐛 Intelligent debugging help

## 🚨 Troubleshooting

### Backend Not Starting
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill existing process
kill -9 $(lsof -ti:3001)

# Restart backend
cd server && npm start
```

### Frontend Connection Issues
- Ensure backend is running on port 3001
- Check browser console for CORS errors
- Verify API endpoints are responding

### WebSocket Connection Failed
- Check firewall settings
- Ensure WebSocket port (3001) is accessible
- Look for connection status indicator in AI chat

## 📱 Preview URLs

- **VedxBuilder App**: http://localhost:3000
- **API Health Check**: http://localhost:3001/api/health
- **API Info**: http://localhost:3001/api/info

## 🎉 Success Indicators

When everything is working:
- ✅ Green connection dot in AI chat panel
- ✅ Terminal commands execute via backend
- ✅ Real-time AI responses (if API key configured)
- ✅ File operations work smoothly

---

**Enjoy coding with VedxBuilder!** ✨