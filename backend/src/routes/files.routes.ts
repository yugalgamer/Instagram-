import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { FSAdapter } from '../services/fs-adapter.js';
import { Logger } from '../utils/logger.js';

const router = Router();
const fsAdapter = FSAdapter.getInstance();
const logger = Logger.getInstance();

// GET /files - Get file tree
router.get('/', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { path: rootPath = '', depth = '5' } = req.query;
    const maxDepth = parseInt(depth as string, 10);
    
    logger.info('File tree request', { correlationId, rootPath, maxDepth });
    
    const fileTree = await fsAdapter.getFileTree(rootPath as string, maxDepth);
    
    res.json({
      tree: fileTree,
      timestamp: new Date().toISOString(),
      correlationId
    });
    
  } catch (error) {
    logger.error('Failed to get file tree', { correlationId, error });
    
    res.status(500).json({
      code: 'FILE_TREE_FAILED',
      message: 'Failed to retrieve file tree',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /files/content - Get file content
router.get('/content', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { path: filePath } = req.query;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        code: 'INVALID_PATH',
        message: 'File path is required',
        correlationId
      });
    }
    
    logger.info('File content request', { correlationId, filePath });
    
    const content = await fsAdapter.readFile(filePath);
    const metadata = await fsAdapter.getFileMetadata(filePath);
    
    res.json({
      content,
      metadata,
      timestamp: new Date().toISOString(),
      correlationId
    });
    
  } catch (error) {
    logger.error('Failed to get file content', { correlationId, error });
    
    res.status(error.message.includes('not allowed') ? 403 : 500).json({
      code: error.message.includes('not allowed') ? 'PATH_FORBIDDEN' : 'FILE_READ_FAILED',
      message: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /files/save - Save file content
router.post('/save', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { path: filePath, content, expectedEtag } = req.body;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        code: 'INVALID_PATH',
        message: 'File path is required',
        correlationId
      });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({
        code: 'INVALID_CONTENT',
        message: 'Content must be a string',
        correlationId
      });
    }
    
    logger.info('File save request', { correlationId, filePath, contentLength: content.length });
    
    // Check for concurrent modifications
    if (expectedEtag && await fsAdapter.exists(filePath)) {
      const currentContent = await fsAdapter.readFile(filePath);
      const currentEtag = require('etag')(currentContent);
      
      if (currentEtag !== expectedEtag) {
        return res.status(409).json({
          code: 'CONCURRENT_MODIFICATION',
          message: 'File was modified by another process',
          currentEtag,
          expectedEtag,
          correlationId
        });
      }
    }
    
    await fsAdapter.writeFile(filePath, content);
    const metadata = await fsAdapter.getFileMetadata(filePath);
    
    res.json({
      success: true,
      metadata,
      timestamp: new Date().toISOString(),
      correlationId
    });
    
  } catch (error) {
    logger.error('Failed to save file', { correlationId, error });
    
    res.status(error.message.includes('not allowed') ? 403 : 500).json({
      code: error.message.includes('not allowed') ? 'PATH_FORBIDDEN' : 'FILE_SAVE_FAILED',
      message: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /files/batch - Batch file operations
router.post('/batch', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        code: 'INVALID_OPERATIONS',
        message: 'Operations must be an array',
        correlationId
      });
    }
    
    logger.info('Batch file operations request', { 
      correlationId, 
      operationsCount: operations.length 
    });
    
    const results = await fsAdapter.batchOperation(operations);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    res.json({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      },
      timestamp: new Date().toISOString(),
      correlationId
    });
    
  } catch (error) {
    logger.error('Batch operations failed', { correlationId, error });
    
    res.status(500).json({
      code: 'BATCH_OPERATIONS_FAILED',
      message: 'Failed to execute batch operations',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /files/metadata - Get file metadata
router.get('/metadata', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  try {
    const { path: filePath } = req.query;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        code: 'INVALID_PATH',
        message: 'File path is required',
        correlationId
      });
    }
    
    const metadata = await fsAdapter.getFileMetadata(filePath);
    
    res.json({
      metadata,
      timestamp: new Date().toISOString(),
      correlationId
    });
    
  } catch (error) {
    logger.error('Failed to get file metadata', { correlationId, error });
    
    res.status(error.message.includes('not allowed') ? 403 : 500).json({
      code: error.message.includes('not allowed') ? 'PATH_FORBIDDEN' : 'METADATA_FAILED',
      message: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;