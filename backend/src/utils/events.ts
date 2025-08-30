import { EventEmitter as NodeEventEmitter } from 'events';
import { WebSocket } from 'ws';
import { StreamEvent, validateStreamEvent } from '../types/contracts.js';
import { Logger } from './logger.js';

export class EventEmitter {
  private static instance: EventEmitter;
  private emitter = new NodeEventEmitter();
  private logger = Logger.getInstance();
  private connections = new Set<WebSocket>();

  private constructor() {
    this.emitter.setMaxListeners(100);
  }

  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  addConnection(ws: WebSocket): void {
    this.connections.add(ws);
    
    ws.on('close', () => {
      this.connections.delete(ws);
    });
    
    ws.on('error', (error) => {
      this.logger.warn('WebSocket error', { error });
      this.connections.delete(ws);
    });

    this.logger.info('WebSocket connection added', { 
      totalConnections: this.connections.size 
    });
  }

  emit(type: StreamEvent['type'], data: any): void {
    const event: StreamEvent = {
      type,
      data,
      correlationId: data.correlationId || 'unknown',
      timestamp: new Date().toISOString()
    };

    try {
      // Validate event before emitting
      validateStreamEvent(event);
      
      // Emit to Node.js EventEmitter for internal listeners
      this.emitter.emit(type, event);
      
      // Broadcast to all WebSocket connections
      this.broadcast(event);
      
      this.logger.debug('Event emitted', { type, correlationId: event.correlationId });
    } catch (error) {
      this.logger.error('Failed to emit event', { type, data, error });
    }
  }

  on(type: StreamEvent['type'], listener: (event: StreamEvent) => void): void {
    this.emitter.on(type, listener);
  }

  off(type: StreamEvent['type'], listener: (event: StreamEvent) => void): void {
    this.emitter.off(type, listener);
  }

  private broadcast(event: StreamEvent): void {
    const message = JSON.stringify(event);
    const deadConnections: WebSocket[] = [];

    for (const ws of this.connections) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        } else {
          deadConnections.push(ws);
        }
      } catch (error) {
        this.logger.warn('Failed to send WebSocket message', { error });
        deadConnections.push(ws);
      }
    }

    // Clean up dead connections
    for (const deadWs of deadConnections) {
      this.connections.delete(deadWs);
    }

    if (deadConnections.length > 0) {
      this.logger.debug('Cleaned up dead WebSocket connections', { 
        count: deadConnections.length,
        remaining: this.connections.size 
      });
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // Utility methods for common event patterns
  emitProgress(correlationId: string, progress: number, message?: string): void {
    this.emit('apply.progress', {
      correlationId,
      progress,
      message
    });
  }

  emitError(correlationId: string, error: string, context?: any): void {
    this.emit('error', {
      correlationId,
      error,
      context
    });
  }

  emitAIToken(correlationId: string, token: string, totalTokens?: number): void {
    this.emit('ai.token', {
      correlationId,
      token,
      totalTokens
    });
  }

  // TODO: Add event persistence for replay capability
  // TODO: Implement event filtering by correlation ID
  // TODO: Add event compression for large payloads
  // TODO: Implement event rate limiting per connection
}

export default EventEmitter;