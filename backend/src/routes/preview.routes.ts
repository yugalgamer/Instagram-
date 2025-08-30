import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import BuildManager from '../services/build-manager.js';
import { Logger } from '../utils/logger.js';

const router = Router();
const buildManager = BuildManager.getInstance();
const logger = Logger.getInstance();

// POST /preview/build - Trigger build
router.post('/build', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    logger.info('Build trigger request', { correlationId });
    
    const buildId = await buildManager.triggerBuild(correlationId);
    
    res.json({
      buildId,
      status: 'queued',
      message: 'Build queued successfully',
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to trigger build', { correlationId, error });
    
    res.status(500).json({
      code: 'BUILD_TRIGGER_FAILED',
      message: 'Failed to trigger build',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /preview/status - Get current build status
router.get('/status', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { buildId } = req.query;
    
    let buildStatus;
    if (buildId && typeof buildId === 'string') {
      buildStatus = buildManager.getBuildStatus(buildId);
      if (!buildStatus) {
        return res.status(404).json({
          code: 'BUILD_NOT_FOUND',
          message: 'Build not found',
          correlationId
        });
      }
    } else {
      buildStatus = buildManager.getCurrentBuildStatus();
    }
    
    res.json({
      build: buildStatus,
      timestamp: new Date().toISOString(),
      correlationId
    });
    
  } catch (error) {
    logger.error('Failed to get build status', { correlationId, error });
    
    res.status(500).json({
      code: 'BUILD_STATUS_FAILED',
      message: 'Failed to get build status',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /preview/cancel - Cancel current build
router.post('/cancel', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { buildId } = req.body;
    
    if (!buildId) {
      return res.status(400).json({
        code: 'INVALID_BUILD_ID',
        message: 'Build ID is required',
        correlationId
      });
    }
    
    const cancelled = await buildManager.cancelBuild(buildId);
    
    res.json({
      success: cancelled,
      message: cancelled ? 'Build cancelled successfully' : 'Build not found or already completed',
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to cancel build', { correlationId, error });
    
    res.status(500).json({
      code: 'BUILD_CANCEL_FAILED',
      message: 'Failed to cancel build',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /preview/url - Get preview URL
router.get('/url', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const previewInfo = await buildManager.startPreviewServer();
    
    res.json({
      url: previewInfo.url,
      port: previewInfo.port,
      status: 'available',
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get preview URL', { correlationId, error });
    
    res.status(500).json({
      code: 'PREVIEW_URL_FAILED',
      message: 'Failed to get preview URL',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;