import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize OpenAI (if API key is provided)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Store for chat sessions (in production, use a database)
const chatSessions = new Map();

// AI Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create chat session
    const chatId = sessionId || uuidv4();
    let chatHistory = chatSessions.get(chatId) || [];
    
    // Add user message to history
    chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    let aiResponse;

    if (openai) {
      // Real OpenAI integration
      try {
        const systemPrompt = `You are VedxAI, an intelligent coding assistant for VedxBuilder IDE. You help developers with:
- Code generation and completion
- Debugging and error fixes
- Code explanations and reviews
- Best practices and optimization
- Project structure suggestions

Always provide helpful, accurate, and practical coding advice. Format code examples with proper syntax highlighting using markdown code blocks.

${context ? `Current file context: ${context}` : ''}`;

        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatHistory.slice(-10) // Keep last 10 messages for context
          ],
          max_tokens: 1000,
          temperature: 0.7,
        });

        aiResponse = completion.choices[0].message.content;
      } catch (openaiError) {
        console.error('OpenAI API Error:', openaiError);
        aiResponse = "I'm experiencing some technical difficulties right now. Please try again in a moment.";
      }
    } else {
      // Enhanced fallback responses when no API key
      aiResponse = generateEnhancedResponse(message, context);
    }

    // Add AI response to history
    chatHistory.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    });

    // Store updated chat history
    chatSessions.set(chatId, chatHistory);

    res.json({
      response: aiResponse,
      sessionId: chatId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced response generator for demo mode
function generateEnhancedResponse(message, context) {
  const lowerMessage = message.toLowerCase();
  
  // Code generation requests
  if (lowerMessage.includes('generate') || lowerMessage.includes('create')) {
    if (lowerMessage.includes('react') || lowerMessage.includes('component')) {
      return `I'll help you create a React component! Here's a modern example:

\`\`\`tsx
import React, { useState, useEffect } from 'react';

interface ${extractComponentName(message) || 'MyComponent'}Props {
  title?: string;
  onAction?: () => void;
}

const ${extractComponentName(message) || 'MyComponent'}: React.FC<${extractComponentName(message) || 'MyComponent'}Props> = ({ 
  title = "Default Title", 
  onAction 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Component initialization logic here
    console.log('Component mounted');
  }, []);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      // Your async logic here
      onAction?.();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="component-container">
      <h2>{title}</h2>
      <button 
        onClick={handleClick}
        disabled={isLoading}
        className="action-button"
      >
        {isLoading ? 'Loading...' : 'Click Me'}
      </button>
    </div>
  );
};

export default ${extractComponentName(message) || 'MyComponent'};
\`\`\`

This component includes:
- TypeScript interfaces for props
- State management with hooks
- Error handling
- Loading states
- Modern React patterns

Would you like me to customize this further or explain any part?`;
    }
    
    if (lowerMessage.includes('api') || lowerMessage.includes('endpoint')) {
      return `Here's a complete API setup for your project:

\`\`\`javascript
// Express API endpoint
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validation
    if (!name || !email) {
      return res.status(400).json({ 
        error: 'Name and email are required' 
      });
    }
    
    // Database operation (example)
    const user = await User.create({ name, email });
    
    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});
\`\`\`

Frontend usage:
\`\`\`typescript
const createUser = async (userData: {name: string, email: string}) => {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create user');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};
\`\`\`

Need help with specific API requirements?`;
    }
  }
  
  // Debugging help
  if (lowerMessage.includes('bug') || lowerMessage.includes('error') || lowerMessage.includes('debug')) {
    return `I'm here to help debug your code! Here's my systematic approach:

🔍 **Common Debugging Steps:**

1. **Check Console Errors**
\`\`\`javascript
// Add detailed logging
console.log('Debug point 1:', variable);
console.error('Error details:', error);
\`\`\`

2. **Validate Data Types**
\`\`\`typescript
// Type checking
if (typeof data !== 'object' || data === null) {
  throw new Error('Invalid data format');
}
\`\`\`

3. **Network Issues**
\`\`\`javascript
// API error handling
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }
} catch (error) {
  console.error('Network error:', error);
}
\`\`\`

**Share your specific error and I'll provide targeted solutions!**`;
  }
  
  // Default enhanced response
  return `I'm VedxAI, your intelligent coding assistant! I can help you with:

🚀 **Code Generation**
- React/Vue/Angular components
- API endpoints and services
- Database schemas and queries
- Utility functions and helpers

🐛 **Debugging & Fixes**
- Error analysis and solutions
- Performance optimization
- Code review and improvements
- Best practice recommendations

📚 **Learning & Explanation**
- Code explanations and walkthroughs
- Technology recommendations
- Architecture patterns
- Documentation generation

**What specific coding challenge can I help you with today?**

*Tip: Be specific about your requirements for better assistance!*`;
}

function extractComponentName(message) {
  const match = message.match(/(?:component|create)\s+(\w+)/i);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : null;
}

// File operations API
app.get('/api/files', (req, res) => {
  // In a real implementation, this would read from filesystem
  const mockFileStructure = {
    name: 'workspace',
    type: 'folder',
    children: [
      {
        name: 'src',
        type: 'folder',
        children: [
          { name: 'App.tsx', type: 'file', size: 1024 },
          { name: 'index.tsx', type: 'file', size: 512 },
          {
            name: 'components',
            type: 'folder',
            children: [
              { name: 'Header.tsx', type: 'file', size: 256 },
              { name: 'Sidebar.tsx', type: 'file', size: 512 }
            ]
          }
        ]
      },
      { name: 'package.json', type: 'file', size: 2048 },
      { name: 'README.md', type: 'file', size: 1536 }
    ]
  };
  
  res.json(mockFileStructure);
});

app.get('/api/file/:path(*)', (req, res) => {
  const filePath = req.params.path;
  
  // Mock file content based on file type
  const mockContent = generateMockFileContent(filePath);
  
  res.json({
    path: filePath,
    content: mockContent,
    lastModified: new Date().toISOString()
  });
});

app.post('/api/file/:path(*)', (req, res) => {
  const filePath = req.params.path;
  const { content } = req.body;
  
  // In real implementation, save to filesystem
  console.log(`Saving file: ${filePath}`);
  
  res.json({
    success: true,
    path: filePath,
    lastModified: new Date().toISOString()
  });
});

function generateMockFileContent(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'tsx':
    case 'jsx':
      return `import React from 'react';

const ${filePath.split('/').pop()?.split('.')[0] || 'Component'} = () => {
  return (
    <div>
      <h1>Hello from ${filePath}</h1>
      <p>This is a sample React component.</p>
    </div>
  );
};

export default ${filePath.split('/').pop()?.split('.')[0] || 'Component'};`;
      
    case 'ts':
    case 'js':
      return `// ${filePath}
console.log('Hello from ${filePath}');

export function main() {
  return 'VedxBuilder is awesome!';
}`;
      
    case 'css':
      return `.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #1e1e1e;
  color: #cccccc;
}

.button {
  padding: 10px 20px;
  background-color: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}`;
      
    case 'md':
      return `# ${filePath.split('/').pop()?.split('.')[0] || 'Document'}

Welcome to your VedxBuilder project!

## Getting Started

This file was generated by VedxBuilder. Start editing to customize your project.

### Features
- Modern development environment
- AI-powered coding assistance
- Integrated terminal and tools

Happy coding! 🚀`;
      
    default:
      return `// ${filePath}
// This is a sample file generated by VedxBuilder
// Start editing to customize your content

console.log('VedxBuilder - Code with AI!');`;
  }
}

// Terminal command execution API
app.post('/api/terminal/execute', (req, res) => {
  const { command, cwd } = req.body;
  
  // Simulate command execution
  const result = simulateTerminalCommand(command, cwd);
  
  res.json({
    output: result.output,
    exitCode: result.exitCode,
    cwd: result.cwd
  });
});

function simulateTerminalCommand(command, cwd = '/workspace') {
  const trimmedCmd = command.trim();
  
  // Enhanced command simulation
  switch (trimmedCmd.toLowerCase()) {
    case 'ls':
    case 'dir':
      return {
        output: `src/          package.json  README.md     node_modules/
components/   tsconfig.json vite.config.ts public/
server/       .env.example  .gitignore`,
        exitCode: 0,
        cwd
      };
      
    case 'pwd':
      return {
        output: cwd,
        exitCode: 0,
        cwd
      };
      
    case 'whoami':
      return {
        output: 'vedxbuilder-user',
        exitCode: 0,
        cwd
      };
      
    case 'node -v':
      return {
        output: 'v18.17.0',
        exitCode: 0,
        cwd
      };
      
    case 'npm -v':
      return {
        output: '9.6.7',
        exitCode: 0,
        cwd
      };
      
    case 'git status':
      return {
        output: `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  
        modified:   src/App.tsx
        modified:   src/components/AIChat.tsx
        
no changes added to commit (use "git add ." or "git commit -a")`,
        exitCode: 0,
        cwd
      };
      
    case 'git log --oneline':
      return {
        output: `a1b2c3d (HEAD -> main) Add VedxAI integration
e4f5g6h Implement code editor features
h7i8j9k Initial VedxBuilder setup
k0l1m2n Add project structure`,
        exitCode: 0,
        cwd
      };
      
    default:
      if (trimmedCmd.startsWith('cd ')) {
        const newPath = trimmedCmd.substring(3).trim();
        return {
          output: '',
          exitCode: 0,
          cwd: newPath.startsWith('/') ? newPath : `${cwd}/${newPath}`
        };
      } else if (trimmedCmd.startsWith('npm ')) {
        return {
          output: `Running: ${trimmedCmd}
✓ Command completed successfully
📦 VedxBuilder packages are up to date`,
          exitCode: 0,
          cwd
        };
      } else if (trimmedCmd.startsWith('git ')) {
        return {
          output: `Git command executed: ${trimmedCmd}
✓ Operation completed successfully`,
          exitCode: 0,
          cwd
        };
      } else if (trimmedCmd === 'clear') {
        return {
          output: '\x1b[2J\x1b[H', // ANSI clear screen
          exitCode: 0,
          cwd
        };
      } else if (trimmedCmd === '') {
        return {
          output: '',
          exitCode: 0,
          cwd
        };
      } else {
        return {
          output: `VedxBuilder Terminal: Command '${trimmedCmd}' executed
✓ Simulated execution successful
💡 This is a demo terminal. In production, commands would execute in a real environment.`,
          exitCode: 0,
          cwd
        };
      }
  }
}

// WebSocket for real-time features
wss.on('connection', (ws) => {
  console.log('Client connected to VedxBuilder WebSocket');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'chat') {
        // Handle real-time chat
        const response = await handleRealtimeChat(message.data);
        ws.send(JSON.stringify({
          type: 'chat_response',
          data: response
        }));
      } else if (message.type === 'terminal') {
        // Handle terminal commands
        const result = simulateTerminalCommand(message.data.command, message.data.cwd);
        ws.send(JSON.stringify({
          type: 'terminal_output',
          data: result
        }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Failed to process message' }
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected from VedxBuilder WebSocket');
  });
});

async function handleRealtimeChat(chatData) {
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are VedxAI, a helpful coding assistant for VedxBuilder IDE. Provide concise, practical coding help.'
          },
          {
            role: 'user',
            content: chatData.message
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      
      return {
        response: completion.choices[0].message.content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Real-time chat error:', error);
      return {
        response: "I'm having trouble connecting to the AI service. Please try again.",
        timestamp: new Date().toISOString()
      };
    }
  } else {
    return {
      response: generateEnhancedResponse(chatData.message),
      timestamp: new Date().toISOString()
    };
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'VedxBuilder API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      aiChat: !!openai,
      terminal: true,
      fileSystem: true,
      websocket: true
    }
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'VedxBuilder API',
    version: '1.0.0',
    description: 'Backend API for VedxBuilder IDE with AI integration',
    endpoints: {
      chat: 'POST /api/chat',
      files: 'GET /api/files',
      terminal: 'POST /api/terminal/execute',
      health: 'GET /api/health'
    },
    websocket: 'ws://localhost:3001',
    documentation: 'https://docs.vedxbuilder.com'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'The requested API endpoint does not exist',
    availableEndpoints: ['/api/chat', '/api/files', '/api/terminal/execute', '/api/health']
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 VedxBuilder Server running on port ${PORT}`);
  console.log(`🌐 API available at: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket available at: ws://localhost:${PORT}`);
  console.log(`🤖 AI Integration: ${openai ? '✅ Enabled' : '❌ Disabled (no API key)'}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});