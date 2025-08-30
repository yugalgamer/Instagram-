import { z } from 'zod';

// Import schemas from backend (shared types)
const FileChangeSchema = z.object({
  file: z.string(),
  op: z.enum(['create', 'update', 'delete', 'rename']),
  applyMethod: z.enum(['diff', 'replaceFile', 'insertAtLine']),
  diff: z.string().optional(),
  content: z.string().optional(),
  newPath: z.string().optional(),
  insertAtLine: z.number().optional(),
  backup: z.boolean().default(true)
});

const AIResponseSchema = z.object({
  id: z.string(),
  summary: z.string(),
  reasoning: z.string(),
  plan: z.object({
    steps: z.array(z.object({
      id: z.string(),
      description: z.string(),
      type: z.enum(['analyze', 'generate', 'modify', 'test', 'deploy']),
      dependencies: z.array(z.string()).default([]),
      estimatedTime: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending')
    })),
    estimatedDuration: z.string().optional()
  }),
  changes: z.array(FileChangeSchema),
  notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  metadata: z.object({
    model: z.string(),
    tokens: z.number().optional(),
    processingTime: z.number(),
    confidence: z.number().min(0).max(1).optional()
  })
});

export type AIResponse = z.infer<typeof AIResponseSchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;

export interface StreamEvent {
  type: 'ai.started' | 'ai.token' | 'ai.completed' | 'fs.diffValidated' | 'apply.progress' | 'build.status' | 'error';
  data: any;
  correlationId: string;
  timestamp: string;
}

export class VedxAPI {
  private static baseURL = 'http://localhost:3001/api';
  private static wsURL = 'ws://localhost:3001/stream';
  private static ws: WebSocket | null = null;
  private static listeners = new Map<string, ((event: StreamEvent) => void)[]>();

  // WebSocket connection management
  static connectWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve(this.ws);
        return;
      }

      this.ws = new WebSocket(this.wsURL);
      
      this.ws.onopen = () => {
        console.log('Connected to VedxBuilder WebSocket');
        resolve(this.ws!);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const streamEvent: StreamEvent = JSON.parse(event.data);
          this.handleStreamEvent(streamEvent);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.ws = null;
        // Auto-reconnect after 3 seconds
        setTimeout(() => this.connectWebSocket(), 3000);
      };
    });
  }

  private static handleStreamEvent(event: StreamEvent): void {
    const eventListeners = this.listeners.get(event.type) || [];
    eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Stream event listener error:', error);
      }
    });
  }

  static onStreamEvent(type: StreamEvent['type'], listener: (event: StreamEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  static offStreamEvent(type: StreamEvent['type'], listener: (event: StreamEvent) => void): void {
    const eventListeners = this.listeners.get(type) || [];
    const index = eventListeners.indexOf(listener);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  }

  // AI Chat API
  static async generatePlan(prompt: string, context?: any): Promise<AIResponse> {
    const correlationId = this.generateCorrelationId();
    
    try {
      const response = await fetch(`${this.baseURL}/ai/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          prompt,
          context,
          modes: {
            dryRun: true,
            maxFilesChanged: 10,
            requireConfirmation: true,
            formatOnSave: true,
            createBackups: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate plan');
      }

      const result = await response.json();
      return AIResponseSchema.parse(result);
    } catch (error) {
      console.error('Plan generation failed:', error);
      throw error;
    }
  }

  static async applyPlan(
    planId: string, 
    selectedFiles?: string[], 
    options?: { createBackups?: boolean; formatOnSave?: boolean; dryRun?: boolean }
  ): Promise<{ success: boolean; appliedFiles: string[]; errors: string[] }> {
    const correlationId = this.generateCorrelationId();
    
    try {
      const response = await fetch(`${this.baseURL}/ai/plan/${planId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          selectedFiles,
          options: {
            createBackups: true,
            formatOnSave: true,
            dryRun: false,
            ...options
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply plan');
      }

      return await response.json();
    } catch (error) {
      console.error('Plan application failed:', error);
      throw error;
    }
  }

  // File System API
  static async getFileTree(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/files`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch file tree');
      }

      const result = await response.json();
      return result.tree;
    } catch (error) {
      console.error('File tree fetch failed:', error);
      throw error;
    }
  }

  static async getFileContent(filePath: string): Promise<{ content: string; metadata: any }> {
    try {
      const response = await fetch(`${this.baseURL}/files/content?path=${encodeURIComponent(filePath)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch file content');
      }

      return await response.json();
    } catch (error) {
      console.error('File content fetch failed:', error);
      throw error;
    }
  }

  static async saveFile(filePath: string, content: string, expectedEtag?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/files/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: filePath,
          content,
          expectedEtag
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'CONCURRENT_MODIFICATION') {
          throw new Error('File was modified by another process');
        }
        throw new Error(error.message || 'Failed to save file');
      }

      return true;
    } catch (error) {
      console.error('File save failed:', error);
      throw error;
    }
  }

  // Build & Preview API
  static async triggerBuild(): Promise<string> {
    const correlationId = this.generateCorrelationId();
    
    try {
      const response = await fetch(`${this.baseURL}/preview/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to trigger build');
      }

      const result = await response.json();
      return result.buildId;
    } catch (error) {
      console.error('Build trigger failed:', error);
      throw error;
    }
  }

  static async getBuildStatus(buildId?: string): Promise<any> {
    try {
      const url = buildId 
        ? `${this.baseURL}/preview/status?buildId=${buildId}`
        : `${this.baseURL}/preview/status`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to get build status');
      }

      const result = await response.json();
      return result.build;
    } catch (error) {
      console.error('Build status fetch failed:', error);
      throw error;
    }
  }

  static async getPreviewURL(): Promise<{ url: string; port: number }> {
    try {
      const response = await fetch(`${this.baseURL}/preview/url`);
      
      if (!response.ok) {
        throw new Error('Failed to get preview URL');
      }

      return await response.json();
    } catch (error) {
      console.error('Preview URL fetch failed:', error);
      throw error;
    }
  }

  // Health check
  static async checkHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/healthz`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'disconnected' };
    }
  }

  private static generateCorrelationId(): string {
    return `vedx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default VedxAPI;