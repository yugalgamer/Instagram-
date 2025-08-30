# VedxBuilder - Production-Ready Development Guide 🚀

## Architecture Overview

VedxBuilder is a complete full-stack AI IDE with:
- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Express + TypeScript + Zod validation + WebSocket streaming
- **AI Integration**: OpenAI GPT with structured JSON responses
- **Real-time Features**: WebSocket events for live updates
- **Transaction System**: Atomic file operations with rollback capability

## Project Structure

```
vedxbuilder/
├── backend/                    # TypeScript Express backend
│   ├── src/
│   │   ├── types/
│   │   │   └── contracts.ts    # Zod schemas & type definitions
│   │   ├── services/
│   │   │   ├── ai.service.ts   # LLM wrapper & JSON extraction
│   │   │   ├── planner.ts      # Plan validation & storage
│   │   │   ├── txn.ts          # Atomic transactions & backups
│   │   │   ├── fs-adapter.ts   # VFS with path whitelist
│   │   │   └── build-manager.ts # Vite build integration
│   │   ├── routes/
│   │   │   ├── ai.routes.ts    # AI plan generation & application
│   │   │   ├── files.routes.ts # File system operations
│   │   │   └── preview.routes.ts # Build & preview management
│   │   ├── utils/
│   │   │   ├── logger.ts       # Structured logging
│   │   │   └── events.ts       # WebSocket event system
│   │   ├── tests/              # Unit tests
│   │   └── server.ts           # Main server entry point
│   ├── package.json
│   └── tsconfig.json
├── src/                        # React frontend
│   ├── components/
│   │   ├── EnhancedAIChat.tsx  # AI chat with plan review
│   │   ├── PlanReview.tsx      # Plan diff viewer & apply UI
│   │   ├── CodespaceUI.tsx     # Build status & preview
│   │   ├── Sidebar.tsx         # File explorer
│   │   ├── CodeEditor.tsx      # Monaco editor
│   │   └── Terminal.tsx        # Integrated terminal
│   ├── services/
│   │   └── vedx-api.ts         # Backend API integration
│   ├── App.tsx                 # Main application
│   └── index.css               # Tailwind + custom styles
├── package.json                # Frontend dependencies
├── tailwind.config.js          # Tailwind configuration
└── vite.config.ts              # Vite configuration
```

## Quick Start

### Option 1: Auto Setup (Recommended)
```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..

# Start both servers
./start-vedxbuilder.sh
```

### Option 2: Manual Setup

1. **Backend Server**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your OpenAI API key (optional)
   npm run dev
   ```

2. **Frontend Server** (new terminal)
   ```bash
   npm install
   npm run dev
   ```

## Environment Configuration

### Backend (.env)
```env
# Required
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
WORKSPACE_ROOT=../

# Optional - For real AI responses
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Security & Performance
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

## API Endpoints

### AI Routes
- `POST /api/ai/plan` - Generate AI plan from prompt
- `POST /api/ai/plan/:planId/apply` - Apply generated plan
- `GET /api/ai/plans` - List all plans
- `GET /api/ai/plan/:planId` - Get specific plan
- `DELETE /api/ai/plan/:planId` - Delete plan

### File System Routes
- `GET /api/files` - Get file tree
- `GET /api/files/content?path=<path>` - Get file content
- `POST /api/files/save` - Save file content
- `POST /api/files/batch` - Batch file operations
- `GET /api/files/metadata?path=<path>` - Get file metadata

### Preview Routes
- `POST /api/preview/build` - Trigger build
- `GET /api/preview/status?buildId=<id>` - Get build status
- `POST /api/preview/cancel` - Cancel current build
- `GET /api/preview/url` - Get preview URL

### System Routes
- `GET /healthz` - Health check
- `WebSocket /stream` - Real-time event streaming

## WebSocket Events

The system emits these real-time events:

- `ai.started` - AI processing begins
- `ai.token` - Token usage updates
- `ai.completed` - AI processing finished
- `fs.diffValidated` - File diff validation result
- `apply.progress` - Plan application progress
- `build.status` - Build status updates
- `error` - Error notifications

## Key Features

### 🤖 AI-Powered Planning
- **Structured Responses**: All AI outputs follow strict Zod schemas
- **Plan Validation**: Comprehensive validation before execution
- **JSON Repair**: Automatic repair of malformed AI responses
- **Context Awareness**: File context and project understanding

### 🔒 Security & Safety
- **Path Whitelisting**: Restricted file system access
- **Transaction System**: Atomic operations with rollback
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Zod schema validation on all inputs
- **CORS Protection**: Configurable origin restrictions

### 📁 File Management
- **Atomic Operations**: All-or-nothing file changes
- **Backup System**: Automatic backups before modifications
- **Conflict Detection**: ETag-based concurrent modification detection
- **Batch Operations**: Efficient multiple file operations

### 🔄 Real-time Updates
- **WebSocket Streaming**: Live progress updates
- **Build Integration**: Real-time build status and errors
- **Event Correlation**: Trace events across the system
- **Connection Health**: Live connection status monitoring

### 🛠️ Development Tools
- **Hot Reload**: Instant updates during development
- **Error Handling**: Comprehensive error reporting
- **Logging**: Structured JSON logging with correlation IDs
- **Testing**: Unit tests for core modules

## Testing

```bash
# Backend tests
cd backend
npm test

# Watch mode
npm run test:watch

# Specific test file
npm test planner.test.ts
```

## Production Deployment

### Security Checklist (TODO)
- [ ] Enable RBAC (Role-Based Access Control)
- [ ] Implement user authentication
- [ ] Add request signing/verification
- [ ] Enable sandbox isolation
- [ ] Add audit logging
- [ ] Implement session management
- [ ] Add CSRF protection
- [ ] Enable HTTPS/WSS

### Performance Optimizations (TODO)
- [ ] Redis for session storage
- [ ] Database for plan persistence
- [ ] CDN for static assets
- [ ] Load balancing
- [ ] Caching strategies
- [ ] Connection pooling

### Monitoring & Observability (TODO)
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] Sentry error tracking
- [ ] Health check endpoints
- [ ] Performance monitoring
- [ ] Log aggregation

## Troubleshooting

### Backend Issues
```bash
# Check if backend is running
curl http://localhost:3001/healthz

# View logs
tail -f backend/logs/combined.log

# Restart backend
cd backend && npm run dev
```

### Frontend Issues
```bash
# Clear cache and restart
rm -rf node_modules/.vite
npm run dev

# Check API connection
curl http://localhost:3001/api/files
```

### WebSocket Issues
```bash
# Test WebSocket connection
wscat -c ws://localhost:3001/stream
```

## Development Tips

1. **API-First Development**: All features start with backend API design
2. **Type Safety**: Use Zod schemas for runtime validation
3. **Event-Driven**: Leverage WebSocket events for real-time UX
4. **Atomic Operations**: Always use transactions for file modifications
5. **Error Handling**: Implement graceful degradation
6. **Testing**: Write tests for critical business logic

## Extension Points

The codebase includes clear extension points for:
- **Additional AI Providers**: Anthropic, Google AI, etc.
- **Authentication Systems**: JWT, OAuth, SAML
- **Database Integration**: PostgreSQL, MongoDB, etc.
- **Caching Layers**: Redis, Memcached
- **File Storage**: S3, Google Cloud Storage
- **Monitoring**: Custom metrics and alerts

---

**Ready to build the future of coding!** ✨