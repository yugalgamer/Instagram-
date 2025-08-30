import { describe, it, expect, beforeEach } from 'vitest';
import PlannerService from '../services/planner.js';
import { AIResponse, FileChange } from '../types/contracts.js';

describe('PlannerService', () => {
  let plannerService: PlannerService;
  let mockPlan: AIResponse;

  beforeEach(() => {
    plannerService = new PlannerService();
    
    mockPlan = {
      id: 'test-plan-1',
      summary: 'Test plan',
      reasoning: 'Test reasoning',
      plan: {
        steps: [
          {
            id: 'step-1',
            description: 'Create component',
            type: 'generate',
            dependencies: [],
            status: 'pending'
          },
          {
            id: 'step-2',
            description: 'Add styles',
            type: 'modify',
            dependencies: ['step-1'],
            status: 'pending'
          }
        ]
      },
      changes: [
        {
          file: 'src/components/TestComponent.tsx',
          op: 'create',
          applyMethod: 'replaceFile',
          content: 'test content'
        }
      ],
      notes: [],
      warnings: [],
      metadata: {
        model: 'test-model',
        processingTime: 100,
        confidence: 0.9
      }
    };
  });

  describe('validatePlan', () => {
    it('should validate a correct plan', async () => {
      const result = await plannerService.validatePlan(mockPlan);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular dependencies', async () => {
      // Create circular dependency
      mockPlan.plan.steps[0].dependencies = ['step-2'];
      
      const result = await plannerService.validatePlan(mockPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('circular'))).toBe(true);
    });

    it('should detect invalid step dependencies', async () => {
      mockPlan.plan.steps[1].dependencies = ['non-existent-step'];
      
      const result = await plannerService.validatePlan(mockPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid dependency'))).toBe(true);
    });
  });

  describe('plan storage', () => {
    it('should store and retrieve plans', async () => {
      await plannerService.storePlan(mockPlan);
      
      const retrieved = plannerService.getPlan(mockPlan.id);
      expect(retrieved).toEqual(mockPlan);
    });

    it('should list all plans', async () => {
      await plannerService.storePlan(mockPlan);
      
      const plans = await plannerService.getAllPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe(mockPlan.id);
    });

    it('should delete plans', async () => {
      await plannerService.storePlan(mockPlan);
      
      const deleted = await plannerService.deletePlan(mockPlan.id);
      expect(deleted).toBe(true);
      
      const retrieved = plannerService.getPlan(mockPlan.id);
      expect(retrieved).toBeNull();
    });
  });
});