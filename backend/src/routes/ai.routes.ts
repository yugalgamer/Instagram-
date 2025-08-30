import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validatePromptRequest, validateApplyPlanRequest } from '../types/contracts.js';
import AIService from '../services/ai.service.js';
import PlannerService from '../services/planner.js';
import TransactionService from '../services/txn.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/events.js';

const router = Router();
const aiService = new AIService();
const plannerService = new PlannerService();
const transactionService = new TransactionService();
const logger = Logger.getInstance();
const eventEmitter = EventEmitter.getInstance();

// POST /ai/plan - Generate AI plan
router.post('/plan', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    // Validate request
    const request = validatePromptRequest(req.body);
    
    logger.info('AI plan request received', { 
      correlationId, 
      prompt: request.prompt.substring(0, 100),
      modes: request.modes 
    });

    // Check idempotency
    if (request.idempotencyKey) {
      // TODO: Implement idempotency check
      // const existingResponse = await checkIdempotencyKey(request.idempotencyKey);
      // if (existingResponse) return res.json(existingResponse);
    }

    // Generate AI response
    const aiResponse = await aiService.generatePlan(request, correlationId);
    
    // Validate and store plan
    const validation = await plannerService.validatePlan(aiResponse);
    if (!validation.valid) {
      aiResponse.warnings.push(...validation.errors);
    }
    
    await plannerService.storePlan(aiResponse);

    // Add security warnings for production
    if (aiResponse.changes.length > (request.modes?.maxFilesChanged || 10)) {
      aiResponse.warnings.push('Plan exceeds maximum file change limit');
    }

    res.json(aiResponse);
    
  } catch (error) {
    logger.error('AI plan generation failed', { correlationId, error });
    
    eventEmitter.emitError(correlationId, error.message, { route: '/ai/plan' });
    
    res.status(500).json({
      code: 'AI_PLAN_FAILED',
      message: 'Failed to generate AI plan',
      correlationId,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
    });
  }
});

// POST /ai/plan/:planId/apply - Apply AI plan
router.post('/plan/:planId/apply', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  const { planId } = req.params;
  
  try {
    // Validate request
    const applyRequest = validateApplyPlanRequest(req.body);
    
    logger.info('Plan apply request received', { 
      correlationId, 
      planId,
      selectedFiles: applyRequest.selectedFiles?.length || 'all',
      options: applyRequest.options 
    });

    // Get stored plan
    const plan = plannerService.getPlan(planId);
    if (!plan) {
      return res.status(404).json({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Filter changes if specific files selected
    let changesToApply = plan.changes;
    if (applyRequest.selectedFiles && applyRequest.selectedFiles.length > 0) {
      changesToApply = plan.changes.filter(change => 
        applyRequest.selectedFiles!.includes(change.file)
      );
    }

    // Execute transaction
    const result = await transactionService.executeTransaction(
      planId,
      changesToApply,
      applyRequest.options,
      correlationId
    );

    if (result.success) {
      logger.info('Plan applied successfully', { 
        correlationId, 
        planId,
        appliedFiles: result.appliedFiles.length 
      });
    } else {
      logger.warn('Plan application had errors', { 
        correlationId, 
        planId,
        errors: result.errors 
      });
    }

    res.json({
      success: result.success,
      appliedFiles: result.appliedFiles,
      errors: result.errors,
      planId,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Plan application failed', { correlationId, planId, error });
    
    eventEmitter.emitError(correlationId, error.message, { route: '/ai/plan/apply', planId });
    
    res.status(500).json({
      code: 'PLAN_APPLY_FAILED',
      message: 'Failed to apply plan',
      correlationId,
      planId,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
    });
  }
});

// GET /ai/plans - List all plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await plannerService.getAllPlans();
    res.json({
      plans: plans.map(plan => ({
        id: plan.id,
        summary: plan.summary,
        changesCount: plan.changes.length,
        metadata: plan.metadata
      }))
    });
  } catch (error) {
    logger.error('Failed to list plans', { error });
    res.status(500).json({
      code: 'PLANS_LIST_FAILED',
      message: 'Failed to retrieve plans'
    });
  }
});

// GET /ai/plan/:planId - Get specific plan
router.get('/plan/:planId', async (req, res) => {
  try {
    const plan = plannerService.getPlan(req.params.planId);
    if (!plan) {
      return res.status(404).json({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found'
      });
    }
    res.json(plan);
  } catch (error) {
    logger.error('Failed to get plan', { planId: req.params.planId, error });
    res.status(500).json({
      code: 'PLAN_GET_FAILED',
      message: 'Failed to retrieve plan'
    });
  }
});

// DELETE /ai/plan/:planId - Delete plan
router.delete('/plan/:planId', async (req, res) => {
  try {
    const deleted = await plannerService.deletePlan(req.params.planId);
    if (!deleted) {
      return res.status(404).json({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found'
      });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete plan', { planId: req.params.planId, error });
    res.status(500).json({
      code: 'PLAN_DELETE_FAILED',
      message: 'Failed to delete plan'
    });
  }
});

export default router;