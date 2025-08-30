import { v4 as uuidv4 } from 'uuid';
import { AIResponse, FileChange, PlanStep } from '../types/contracts.js';
import { Logger } from '../utils/logger.js';
import { FSAdapter } from './fs-adapter.js';

export class PlannerService {
  private logger = Logger.getInstance();
  private fsAdapter = FSAdapter.getInstance();
  private activePlans = new Map<string, AIResponse>();

  async validatePlan(response: AIResponse): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate file operations
      for (const change of response.changes) {
        const validation = await this.validateFileChange(change);
        if (!validation.valid) {
          errors.push(`File ${change.file}: ${validation.error}`);
        }
      }

      // Validate plan steps dependencies
      const stepIds = new Set(response.plan.steps.map(s => s.id));
      for (const step of response.plan.steps) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(`Step ${step.id} has invalid dependency: ${depId}`);
          }
        }
      }

      // Check circular dependencies
      if (this.hasCircularDependencies(response.plan.steps)) {
        errors.push('Plan contains circular dependencies');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      this.logger.error('Plan validation error', { error, planId: response.id });
      return { valid: false, errors: ['Internal validation error'] };
    }
  }

  async storePlan(response: AIResponse): Promise<void> {
    this.activePlans.set(response.id, response);
    
    // TODO: Persist plans to database for production
    // TODO: Add plan expiration and cleanup
    this.logger.info('Plan stored', { planId: response.id, changesCount: response.changes.length });
  }

  getPlan(planId: string): AIResponse | null {
    return this.activePlans.get(planId) || null;
  }

  async getAllPlans(): Promise<AIResponse[]> {
    return Array.from(this.activePlans.values());
  }

  async deletePlan(planId: string): Promise<boolean> {
    const deleted = this.activePlans.delete(planId);
    this.logger.info('Plan deleted', { planId, deleted });
    return deleted;
  }

  private async validateFileChange(change: FileChange): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if file path is allowed
      if (!this.fsAdapter.isPathAllowed(change.file)) {
        return { valid: false, error: 'Path not allowed by security policy' };
      }

      // Validate operation type
      switch (change.op) {
        case 'create':
          if (await this.fsAdapter.exists(change.file)) {
            return { valid: false, error: 'File already exists' };
          }
          break;
          
        case 'update':
          if (!(await this.fsAdapter.exists(change.file))) {
            return { valid: false, error: 'File does not exist' };
          }
          break;
          
        case 'delete':
          if (!(await this.fsAdapter.exists(change.file))) {
            return { valid: false, error: 'File does not exist' };
          }
          break;
          
        case 'rename':
          if (!(await this.fsAdapter.exists(change.file))) {
            return { valid: false, error: 'Source file does not exist' };
          }
          if (!change.newPath) {
            return { valid: false, error: 'New path required for rename operation' };
          }
          break;
      }

      // Validate apply method
      if (change.applyMethod === 'diff' && !change.diff) {
        return { valid: false, error: 'Diff content required for diff apply method' };
      }
      
      if (change.applyMethod === 'replaceFile' && !change.content) {
        return { valid: false, error: 'Content required for replaceFile apply method' };
      }
      
      if (change.applyMethod === 'insertAtLine' && (change.insertAtLine === undefined || !change.content)) {
        return { valid: false, error: 'Line number and content required for insertAtLine apply method' };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error('File change validation error', { error, change });
      return { valid: false, error: 'Validation error' };
    }
  }

  private hasCircularDependencies(steps: PlanStep[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true; // Circular dependency found
      }
      
      if (visited.has(stepId)) {
        return false; // Already processed
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.id)) {
        return true;
      }
    }

    return false;
  }

  // TODO: Add plan optimization (merge similar operations)
  // TODO: Add plan cost estimation
  // TODO: Add plan rollback capability
  // TODO: Add plan versioning and history
}

export default PlannerService;