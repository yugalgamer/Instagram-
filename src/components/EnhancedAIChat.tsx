import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Copy, 
  RotateCcw,
  Settings,
  Sparkles,
  Code,
  FileText,
  Lightbulb,
  Wifi,
  WifiOff,
  Zap,
  Brain
} from 'lucide-react';
import VedxAPI, { AIResponse } from '../services/vedx-api';
import PlanReview from './PlanReview';
import clsx from 'clsx';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'plan';
  content: string;
  timestamp: Date;
  plan?: AIResponse;
  correlationId?: string;
}

const EnhancedAIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Hello! I'm VedxAI, your intelligent coding assistant. I can help you with:

🚀 **Code Generation** - Create components, functions, and complete features
🐛 **Debugging** - Find and fix issues in your code  
📝 **Code Review** - Analyze and improve your code quality
🏗️ **Architecture** - Design better project structures
⚡ **Optimization** - Improve performance and best practices

Ask me anything about your code, and I'll provide a detailed plan with actionable steps!`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<AIResponse | null>(null);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connect to WebSocket and check health
    VedxAPI.connectWebSocket()
      .then(() => {
        setIsConnected(true);
        
        // Listen to AI events
        VedxAPI.onStreamEvent('ai.started', (event) => {
          console.log('AI started processing:', event);
        });
        
        VedxAPI.onStreamEvent('ai.completed', (event) => {
          console.log('AI completed:', event);
          setIsGenerating(false);
        });
        
        VedxAPI.onStreamEvent('ai.token', (event) => {
          console.log('AI token:', event);
        });
        
        VedxAPI.onStreamEvent('error', (event) => {
          console.error('AI error:', event);
          setIsGenerating(false);
        });
      })
      .catch(() => {
        setIsConnected(false);
      });

    // Check API health
    VedxAPI.checkHealth()
      .then(health => {
        console.log('VedxBuilder API Health:', health);
        setIsConnected(health.status === 'healthy');
      })
      .catch(() => setIsConnected(false));

    return () => {
      VedxAPI.offStreamEvent('ai.started', () => {});
      VedxAPI.offStreamEvent('ai.completed', () => {});
      VedxAPI.offStreamEvent('ai.token', () => {});
      VedxAPI.offStreamEvent('error', () => {});
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputValue.trim();
    setInputValue('');
    setIsGenerating(true);

    try {
      // Generate plan using backend API
      const aiResponse = await VedxAPI.generatePlan(messageContent, {
        currentFile: 'src/App.tsx', // TODO: Get from editor context
        openFiles: ['src/App.tsx'], // TODO: Get from app state
        projectType: 'react',
        framework: 'vite'
      });

      const planMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'plan',
        content: aiResponse.summary,
        timestamp: new Date(),
        plan: aiResponse,
        correlationId: aiResponse.id
      };

      setMessages(prev => [...prev, planMessage]);
      setIsGenerating(false);

    } catch (error) {
      console.error('Failed to generate plan:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I'm having trouble generating a plan right now. Error: ${error.message}

Please check that the VedxBuilder backend is running on port 3001, or try again in a moment.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePlanReview = (plan: AIResponse) => {
    setCurrentPlan(plan);
  };

  const handleApplyPlan = async (selectedFiles: string[], options: any) => {
    if (!currentPlan) return;

    setIsApplyingPlan(true);
    
    try {
      const result = await VedxAPI.applyPlan(currentPlan.id, selectedFiles, options);
      
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: result.success 
          ? `✅ Plan applied successfully!\n\nApplied files:\n${result.appliedFiles.map(f => `• ${f}`).join('\n')}`
          : `❌ Plan application failed:\n\n${result.errors.join('\n')}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, resultMessage]);
      setCurrentPlan(null);
      
    } catch (error) {
      console.error('Failed to apply plan:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `❌ Failed to apply plan: ${error.message}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsApplyingPlan(false);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      type: 'assistant',
      content: `Hello! I'm VedxAI, your intelligent coding assistant. I can help you with:

🚀 **Code Generation** - Create components, functions, and complete features
🐛 **Debugging** - Find and fix issues in your code  
📝 **Code Review** - Analyze and improve your code quality
🏗️ **Architecture** - Design better project structures
⚡ **Optimization** - Improve performance and best practices

Ask me anything about your code, and I'll provide a detailed plan with actionable steps!`,
      timestamp: new Date()
    }]);
  };

  const quickPrompts = [
    { icon: Code, text: "Create a new React component", category: "generate" },
    { icon: Lightbulb, text: "Optimize this code for performance", category: "optimize" },
    { icon: FileText, text: "Add comprehensive documentation", category: "document" },
    { icon: Sparkles, text: "Refactor to use modern patterns", category: "refactor" }
  ];

  return (
    <>
      <div className="h-full bg-vedx-secondary flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-vedx-border bg-vedx-tertiary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-vedx-accent-blue" />
              <span className="text-sm font-medium text-vedx-text-primary">VedxAI Assistant</span>
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-vedx-accent-green" title="Connected" />
                ) : (
                  <WifiOff className="w-3 h-3 text-vedx-accent-red" title="Disconnected" />
                )}
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-vedx-accent-green animate-pulse-slow' : 'bg-vedx-accent-red'
                )} />
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={clearChat}
                className="p-1.5 hover:bg-vedx-hover rounded text-vedx-text-muted hover:text-vedx-text-primary"
                title="Clear Chat"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button 
                className="p-1.5 hover:bg-vedx-hover rounded text-vedx-text-muted hover:text-vedx-text-primary"
                title="AI Settings"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                'flex gap-3',
                message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                message.type === 'user' 
                  ? 'bg-vedx-accent-blue' 
                  : message.type === 'plan'
                  ? 'bg-vedx-accent-green'
                  : 'bg-vedx-accent-purple'
              )}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : message.type === 'plan' ? (
                  <Zap className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              
              <div className={clsx(
                'max-w-[85%] rounded-lg p-3 border',
                message.type === 'user' 
                  ? 'bg-vedx-hover border-vedx-border' 
                  : 'bg-vedx-tertiary border-vedx-border'
              )}>
                <div className="prose prose-sm prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                </div>
                
                {message.type === 'plan' && message.plan && (
                  <div className="mt-3 pt-3 border-t border-vedx-border">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-vedx-text-secondary">
                        {message.plan.changes.length} file(s) • {message.plan.plan.steps.length} step(s)
                      </div>
                      <button
                        onClick={() => handlePlanReview(message.plan!)}
                        className="px-3 py-1 text-xs bg-vedx-accent-blue text-white rounded hover:bg-vedx-accent-blue/80 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Review Plan
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-vedx-border/50">
                  <span className="text-xs text-vedx-text-muted">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  
                  {message.type === 'assistant' && (
                    <button 
                      onClick={() => copyMessage(message.content)}
                      className="p-1 hover:bg-vedx-hover rounded text-vedx-text-muted hover:text-vedx-text-primary"
                      title="Copy message"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isGenerating && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-vedx-accent-purple flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-vedx-tertiary border border-vedx-border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-vedx-text-secondary">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-vedx-accent-blue rounded-full animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                  <span>VedxAI is analyzing and generating a plan...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <div className="text-xs text-vedx-text-muted mb-2 font-medium uppercase tracking-wide">
              Quick Start
            </div>
            <div className="grid grid-cols-1 gap-2">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInputValue(prompt.text)}
                  className="p-2 text-left bg-vedx-tertiary border border-vedx-border rounded hover:bg-vedx-hover hover:border-vedx-accent-blue/50 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <prompt.icon className="w-3 h-3 text-vedx-accent-blue" />
                    <span className="text-xs text-vedx-text-primary">{prompt.text}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-vedx-border bg-vedx-secondary">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to build or improve..."
              className="flex-1 min-h-[2.5rem] max-h-32 p-2 bg-vedx-tertiary border border-vedx-border rounded-lg text-sm text-vedx-text-primary placeholder-vedx-text-muted resize-none focus:outline-none focus:border-vedx-accent-blue"
              disabled={isGenerating}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isGenerating}
              className={clsx(
                'px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all',
                inputValue.trim() && !isGenerating
                  ? 'bg-vedx-accent-blue text-white hover:bg-vedx-accent-blue/80'
                  : 'bg-vedx-tertiary text-vedx-text-muted cursor-not-allowed'
              )}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
          
          {!isConnected && (
            <div className="mt-2 text-xs text-vedx-accent-red flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Disconnected from VedxAI service
            </div>
          )}
        </div>
      </div>

      {/* Plan Review Modal */}
      {currentPlan && (
        <PlanReview
          plan={currentPlan}
          onApply={handleApplyPlan}
          onCancel={() => setCurrentPlan(null)}
          isApplying={isApplyingPlan}
        />
      )}
    </>
  );

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content);
  }
};

export default EnhancedAIChat;