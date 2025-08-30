import { spawn, ChildProcess } from 'child_process';
import { EventEmitter as NodeEventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BuildStatus } from '../types/contracts.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/events.js';

export class BuildManager {
  private static instance: BuildManager;
  private logger = Logger.getInstance();
  private eventEmitter = EventEmitter.getInstance();
  private currentBuild: ChildProcess | null = null;
  private buildQueue: Array<{ id: string; correlationId: string }> = [];
  private isBuilding = false;
  private lastBuildTime = 0;
  private debounceDelay = 2000; // 2 seconds
  private buildHistory = new Map<string, BuildStatus>();

  private constructor() {}

  static getInstance(): BuildManager {
    if (!BuildManager.instance) {
      BuildManager.instance = new BuildManager();
    }
    return BuildManager.instance;
  }

  async triggerBuild(correlationId: string): Promise<string> {
    const buildId = uuidv4();
    
    this.buildQueue.push({ id: buildId, correlationId });
    this.logger.info('Build queued', { buildId, correlationId, queueLength: this.buildQueue.length });

    // Debounced build execution
    this.debouncedBuild();
    
    return buildId;
  }

  private debouncedBuild() {
    clearTimeout(this.buildTimeout);
    this.buildTimeout = setTimeout(() => {
      if (!this.isBuilding && this.buildQueue.length > 0) {
        this.executeBuild();
      }
    }, this.debounceDelay);
  }

  private buildTimeout: NodeJS.Timeout | null = null;

  private async executeBuild(): Promise<void> {
    if (this.isBuilding || this.buildQueue.length === 0) {
      return;
    }

    const { id: buildId, correlationId } = this.buildQueue.shift()!;
    this.isBuilding = true;
    this.lastBuildTime = Date.now();

    const buildStatus: BuildStatus = {
      id: buildId,
      status: 'building',
      startTime: new Date().toISOString(),
      errors: []
    };

    this.buildHistory.set(buildId, buildStatus);
    this.emitBuildStatus(buildStatus, correlationId);

    try {
      this.logger.info('Starting build', { buildId, correlationId });

      // Kill existing build if running
      if (this.currentBuild) {
        this.currentBuild.kill('SIGTERM');
      }

      // Start Vite build process
      this.currentBuild = spawn('npm', ['run', 'build'], {
        cwd: process.cwd().replace('/backend', ''), // Go to frontend directory
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let output = '';
      let errorOutput = '';

      this.currentBuild.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Stream build output in real-time
        this.eventEmitter.emit('build.status', {
          correlationId,
          buildId,
          type: 'output',
          data: chunk
        });
      });

      this.currentBuild.stderr?.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        // Parse errors from build output
        this.parseBuildErrors(chunk, buildStatus);
      });

      this.currentBuild.on('close', (code) => {
        const endTime = new Date().toISOString();
        const duration = Date.now() - this.lastBuildTime;

        buildStatus.endTime = endTime;
        buildStatus.duration = duration;
        buildStatus.output = output;

        if (code === 0) {
          buildStatus.status = 'success';
          buildStatus.artifacts = {
            distPath: 'dist/',
            previewUrl: `http://localhost:${process.env.PREVIEW_PORT || 4173}`,
            size: this.calculateBuildSize(output)
          };
          
          this.logger.info('Build completed successfully', { 
            buildId, 
            correlationId, 
            duration 
          });
        } else {
          buildStatus.status = 'failed';
          this.logger.error('Build failed', { 
            buildId, 
            correlationId, 
            exitCode: code,
            errorOutput 
          });
        }

        this.buildHistory.set(buildId, buildStatus);
        this.emitBuildStatus(buildStatus, correlationId);
        
        this.isBuilding = false;
        this.currentBuild = null;

        // Process next build in queue
        if (this.buildQueue.length > 0) {
          setTimeout(() => this.executeBuild(), 1000);
        }
      });

      this.currentBuild.on('error', (error) => {
        buildStatus.status = 'failed';
        buildStatus.endTime = new Date().toISOString();
        buildStatus.duration = Date.now() - this.lastBuildTime;
        
        buildStatus.errors.push({
          file: 'build-process',
          message: error.message,
          severity: 'error'
        });

        this.buildHistory.set(buildId, buildStatus);
        this.emitBuildStatus(buildStatus, correlationId);
        
        this.logger.error('Build process error', { buildId, correlationId, error });
        this.isBuilding = false;
        this.currentBuild = null;
      });

    } catch (error) {
      buildStatus.status = 'failed';
      buildStatus.endTime = new Date().toISOString();
      buildStatus.duration = Date.now() - this.lastBuildTime;
      
      this.buildHistory.set(buildId, buildStatus);
      this.emitBuildStatus(buildStatus, correlationId);
      
      this.logger.error('Failed to start build', { buildId, correlationId, error });
      this.isBuilding = false;
    }
  }

  private parseBuildErrors(output: string, buildStatus: BuildStatus): void {
    // Parse Vite/TypeScript error output
    const errorPatterns = [
      // TypeScript errors: src/App.tsx:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
      /^(.+?):(\d+):(\d+)\s*-\s*error\s+TS\d+:\s*(.+)$/gm,
      // ESLint errors: /path/to/file.ts:15:3: error message
      /^(.+?):(\d+):(\d+):\s*(.+)$/gm,
      // Vite build errors
      /Error:\s*(.+?)\s*at\s*(.+?):(\d+):(\d+)/gm
    ];

    for (const pattern of errorPatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const [, file, line, column, message] = match;
        
        buildStatus.errors.push({
          file: file.replace(process.cwd(), '').replace(/^\//, ''),
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          message: message.trim(),
          severity: output.includes('warning') ? 'warning' : 'error'
        });
      }
    }
  }

  private calculateBuildSize(output: string): number {
    // Extract build size from Vite output
    const sizeMatch = output.match(/dist\/.*?(\d+(?:\.\d+)?)\s*(kB|MB)/);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2];
      return unit === 'MB' ? size * 1024 * 1024 : size * 1024;
    }
    return 0;
  }

  private emitBuildStatus(buildStatus: BuildStatus, correlationId: string): void {
    this.eventEmitter.emit('build.status', {
      correlationId,
      buildId: buildStatus.id,
      status: buildStatus.status,
      duration: buildStatus.duration,
      errors: buildStatus.errors,
      artifacts: buildStatus.artifacts
    });
  }

  getBuildStatus(buildId: string): BuildStatus | null {
    return this.buildHistory.get(buildId) || null;
  }

  getCurrentBuildStatus(): BuildStatus | null {
    if (!this.isBuilding) {
      return { id: 'none', status: 'idle', errors: [] };
    }

    // Return current build status
    const builds = Array.from(this.buildHistory.values());
    return builds.find(b => b.status === 'building') || null;
  }

  async cancelBuild(buildId: string): Promise<boolean> {
    if (this.currentBuild && this.isBuilding) {
      this.currentBuild.kill('SIGTERM');
      this.isBuilding = false;
      
      const buildStatus = this.buildHistory.get(buildId);
      if (buildStatus) {
        buildStatus.status = 'failed';
        buildStatus.endTime = new Date().toISOString();
        buildStatus.errors.push({
          file: 'build-process',
          message: 'Build cancelled by user',
          severity: 'info'
        });
        this.buildHistory.set(buildId, buildStatus);
      }
      
      this.logger.info('Build cancelled', { buildId });
      return true;
    }
    
    return false;
  }

  async startPreviewServer(): Promise<{ url: string; port: number }> {
    const port = parseInt(process.env.PREVIEW_PORT || '4173', 10);
    
    // TODO: Start Vite preview server
    // For now, return mock URL
    const url = `http://localhost:${port}`;
    
    this.logger.info('Preview server started', { url, port });
    
    return { url, port };
  }

  // TODO: Add build caching and incremental builds
  // TODO: Implement build artifacts management
  // TODO: Add support for multiple build targets (dev, staging, prod)
  // TODO: Implement build notifications and webhooks
  // TODO: Add build performance metrics and optimization suggestions
}

export default BuildManager;