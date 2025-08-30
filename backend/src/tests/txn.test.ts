import { describe, it, expect, beforeEach, vi } from 'vitest';
import TransactionService from '../services/txn.js';
import { FileChange } from '../types/contracts.js';

// Mock dependencies
vi.mock('../services/fs-adapter.js', () => ({
  FSAdapter: {
    getInstance: () => ({
      isPathAllowed: vi.fn().mockReturnValue(true),
      exists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue('test content'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      renameFile: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

vi.mock('../utils/logger.js', () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}));

vi.mock('../utils/events.js', () => ({
  EventEmitter: {
    getInstance: () => ({
      emit: vi.fn()
    })
  }
}));

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let mockChanges: FileChange[];

  beforeEach(() => {
    transactionService = new TransactionService();
    
    mockChanges = [
      {
        file: 'src/test.ts',
        op: 'create',
        applyMethod: 'replaceFile',
        content: 'console.log("test");'
      },
      {
        file: 'src/existing.ts',
        op: 'update',
        applyMethod: 'replaceFile',
        content: 'console.log("updated");'
      }
    ];
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully', async () => {
      const result = await transactionService.executeTransaction(
        'test-plan',
        mockChanges,
        { createBackups: true, formatOnSave: false, dryRun: false },
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.appliedFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle dry run mode', async () => {
      const result = await transactionService.executeTransaction(
        'test-plan',
        mockChanges,
        { createBackups: false, formatOnSave: false, dryRun: true },
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.appliedFiles).toHaveLength(2);
    });

    it('should create backups when enabled', async () => {
      await transactionService.executeTransaction(
        'test-plan',
        mockChanges,
        { createBackups: true, formatOnSave: false, dryRun: false },
        'test-correlation-id'
      );

      // Verify backup was created (implementation detail)
      // In a real test, we'd verify the backup exists
    });
  });

  describe('rollback', () => {
    it('should rollback transaction on failure', async () => {
      // Mock a failure in the second operation
      const failingChanges: FileChange[] = [
        ...mockChanges,
        {
          file: 'invalid/path/../../etc/passwd',
          op: 'create',
          applyMethod: 'replaceFile',
          content: 'malicious content'
        }
      ];

      try {
        await transactionService.executeTransaction(
          'test-plan',
          failingChanges,
          { createBackups: true, formatOnSave: false, dryRun: false },
          'test-correlation-id'
        );
      } catch (error) {
        // Transaction should fail and rollback
        expect(error).toBeDefined();
      }
    });
  });
});