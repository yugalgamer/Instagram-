// VedxBuilder API Service
const API_BASE_URL = 'http://localhost:3001/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: string;
}

export interface TerminalResult {
  output: string;
  exitCode: number;
  cwd: string;
}

export class VedxAPI {
  private static sessionId: string | null = null;

  // Chat API
  static async sendChatMessage(
    message: string, 
    context?: string
  ): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
          context
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const result = await response.json();
      this.sessionId = result.sessionId;
      return result;
    } catch (error) {
      console.error('Chat API Error:', error);
      throw new Error('Failed to send message to VedxAI');
    }
  }

  // Terminal API
  static async executeCommand(
    command: string, 
    cwd: string = '/workspace'
  ): Promise<TerminalResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/terminal/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          cwd
        }),
      });

      if (!response.ok) {
        throw new Error(`Terminal API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Terminal API Error:', error);
      return {
        output: `Error executing command: ${error.message}`,
        exitCode: 1,
        cwd
      };
    }
  }

  // File System API
  static async getFileStructure(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/files`);
      
      if (!response.ok) {
        throw new Error(`Files API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Files API Error:', error);
      throw new Error('Failed to load file structure');
    }
  }

  static async getFileContent(filePath: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/file/${encodeURIComponent(filePath)}`);
      
      if (!response.ok) {
        throw new Error(`File API error: ${response.status}`);
      }

      const result = await response.json();
      return result.content;
    } catch (error) {
      console.error('File Content API Error:', error);
      throw new Error('Failed to load file content');
    }
  }

  static async saveFileContent(filePath: string, content: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/file/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Save API error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Save File API Error:', error);
      return false;
    }
  }

  // Health check
  static async checkHealth(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'disconnected' };
    }
  }
}

// WebSocket service for real-time features
export class VedxWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private onMessage: (data: any) => void,
    private onConnectionChange: (connected: boolean) => void
  ) {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket('ws://localhost:3001');
      
      this.ws.onopen = () => {
        console.log('Connected to VedxBuilder WebSocket');
        this.reconnectAttempts = 0;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from VedxBuilder WebSocket');
        this.onConnectionChange(false);
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onConnectionChange(false);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  sendMessage(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}