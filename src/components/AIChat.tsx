import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Copy, 
  ThumbsUp, 
  ThumbsDown,
  RotateCcw,
  Settings,
  Sparkles,
  Code,
  FileText,
  Lightbulb,
  Wifi,
  WifiOff
} from 'lucide-react';
import { VedxAPI, VedxWebSocket } from '../services/api';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isCode?: boolean;
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Hello! I'm your VedxBuilder AI assistant. I'm here to help you with:

• Code generation and completion
• Debugging and error fixes  
• Code explanations and reviews
• Project structure suggestions
• Best practices and optimization

What would you like to work on today?`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [wsConnection, setWsConnection] = useState<VedxWebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new VedxWebSocket(
      (data) => {
        if (data.type === 'chat_response') {
          const aiMessage: Message = {
            id: Date.now().toString(),
            type: 'assistant',
            content: data.data.response,
            timestamp: new Date(data.data.timestamp)
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsTyping(false);
        }
      },
      (connected) => {
        setIsConnected(connected);
      }
    );
    
    setWsConnection(ws);
    
    // Check API health
    VedxAPI.checkHealth().then(health => {
      console.log('VedxBuilder API Health:', health);
    });

    return () => {
      ws.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return "Hello! I'm ready to help you code. What can I assist you with today?";
    }
    
    if (lowerMessage.includes('react') || lowerMessage.includes('component')) {
      return `I can help you with React components! Here's a simple example:

\`\`\`tsx
import React, { useState } from 'react';

const MyComponent: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
};

export default MyComponent;
\`\`\`

Would you like me to explain any part of this or help with something specific?`;
    }
    
    if (lowerMessage.includes('bug') || lowerMessage.includes('error') || lowerMessage.includes('fix')) {
      return `I'd be happy to help debug your code! To better assist you, please:

1. Share the error message you're seeing
2. Show me the problematic code
3. Describe what you expected to happen

Common debugging steps I can help with:
• Checking syntax errors
• Reviewing logic flow
• Identifying missing dependencies
• Optimizing performance issues`;
    }
    
    if (lowerMessage.includes('typescript') || lowerMessage.includes('types')) {
      return `TypeScript is great for building robust applications! Here are some common patterns:

\`\`\`typescript
// Interface definition
interface User {
  id: number;
  name: string;
  email: string;
  isActive?: boolean;
}

// Generic function
function processData<T>(data: T[]): T[] {
  return data.filter(item => item !== null);
}

// Union types
type Status = 'loading' | 'success' | 'error';
\`\`\`

What specific TypeScript topic would you like to explore?`;
    }
    
    if (lowerMessage.includes('css') || lowerMessage.includes('style') || lowerMessage.includes('design')) {
      return `I can help you with CSS and styling! Here are some modern CSS techniques:

\`\`\`css
/* Flexbox layout */
.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

/* CSS Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

/* Custom properties (CSS variables) */
:root {
  --primary-color: #007acc;
  --font-size: 1rem;
}
\`\`\`

What styling challenge can I help you with?`;
    }
    
    if (lowerMessage.includes('api') || lowerMessage.includes('fetch') || lowerMessage.includes('axios')) {
      return `Here's how to handle API calls effectively:

\`\`\`typescript
// Using fetch with async/await
async function fetchUserData(userId: string) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    
    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    throw error;
  }
}

// Using with React
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  fetchUserData('123')
    .then(setData)
    .finally(() => setLoading(false));
}, []);
\`\`\`

Need help with a specific API integration?`;
    }
    
    // Default response
    return `I understand you're asking about: "${userMessage}"

I'm here to help with:
• Writing and reviewing code
• Explaining programming concepts
• Debugging issues
• Suggesting best practices
• Code optimization

Could you provide more details about what you'd like to accomplish? The more context you give me, the better I can assist you!`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputValue.trim();
    setInputValue('');
    setIsTyping(true);

    try {
      // Try WebSocket first for real-time experience
      if (wsConnection && isConnected) {
        wsConnection.sendMessage('chat', {
          message: messageContent,
          timestamp: new Date().toISOString()
        });
      } else {
        // Fallback to REST API
        const response = await VedxAPI.sendChatMessage(messageContent);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.response,
          timestamp: new Date(response.timestamp)
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Fallback to local simulation if API fails
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I'm having trouble connecting to the VedxAI service right now. Here's a local response:

${simulateAIResponse(messageContent)}

*Note: This is a fallback response. Please check your connection to the VedxBuilder backend.*`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      type: 'assistant',
      content: `Hello! I'm your VedxBuilder AI assistant. I'm here to help you with:

• Code generation and completion
• Debugging and error fixes  
• Code explanations and reviews
• Project structure suggestions
• Best practices and optimization

What would you like to work on today?`,
      timestamp: new Date()
    }]);
  };

  const quickPrompts = [
    { icon: Code, text: "Generate a React component" },
    { icon: Lightbulb, text: "Explain this code" },
    { icon: FileText, text: "Write documentation" },
    { icon: Sparkles, text: "Optimize performance" }
  ];

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--bg-secondary)'
    }}>
      {/* Chat Header */}
      <div style={{
        height: '35px',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={14} color="var(--accent-blue)" />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>VedxAI Assistant</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isConnected ? (
              <Wifi size={10} color="var(--accent-green)" title="Connected to VedxAI" />
            ) : (
              <WifiOff size={10} color="var(--accent-red)" title="Disconnected" />
            )}
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--accent-green)' : 'var(--accent-red)',
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }} />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="vedx-button"
            style={{ padding: '4px' }}
            onClick={clearChat}
            title="Clear Chat"
          >
            <RotateCcw size={12} />
          </button>
          <button 
            className="vedx-button"
            style={{ padding: '4px' }}
            title="AI Settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: message.type === 'user' ? 'var(--accent-blue)' : 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {message.type === 'user' ? <User size={12} /> : <Bot size={12} />}
            </div>
            
            <div style={{
              backgroundColor: message.type === 'user' ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 12px',
              maxWidth: '85%',
              fontSize: '12px',
              lineHeight: '1.4'
            }}>
              <div style={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: message.content.includes('```') ? 'Fira Code, monospace' : 'inherit'
              }}>
                {message.content}
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '6px',
                fontSize: '10px',
                color: 'var(--text-muted)'
              }}>
                <span>{message.timestamp.toLocaleTimeString()}</span>
                
                {message.type === 'assistant' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => copyMessage(message.content)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '2px'
                      }}
                      title="Copy message"
                    >
                      <Copy size={10} />
                    </button>
                    <button 
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '2px'
                      }}
                      title="Good response"
                    >
                      <ThumbsUp size={10} />
                    </button>
                    <button 
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '2px'
                      }}
                      title="Poor response"
                    >
                      <ThumbsDown size={10} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={12} />
            </div>
            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span>VedxAI is thinking</span>
                <div style={{
                  display: 'flex',
                  gap: '2px'
                }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-blue)',
                        animation: `pulse 1.4s infinite ${i * 0.2}s`
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length === 1 && (
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{ 
            fontSize: '10px', 
            color: 'var(--text-muted)', 
            marginBottom: '6px',
            textTransform: 'uppercase',
            fontWeight: 600
          }}>
            Quick Start
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                className="vedx-button"
                onClick={() => setInputValue(prompt.text)}
                style={{
                  fontSize: '11px',
                  padding: '6px 8px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <prompt.icon size={12} />
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask VedxAI anything about code..."
            style={{
              flex: 1,
              minHeight: '32px',
              maxHeight: '120px',
              padding: '8px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none'
            }}
            disabled={isTyping}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            style={{
              padding: '8px',
              backgroundColor: inputValue.trim() ? 'var(--accent-blue)' : 'var(--bg-hover)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;