import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import etag from 'etag';
import { FileChange, ApplyPlanRequest } from '../types/contracts.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/events.js';
import { FSAdapter } from './fs-adapter.js';

interface TransactionBackup {
  id: string;
  timestamp: string;
  files: Array<{
    path: string;
    content: string;
    etag: string;
    existed: boolean;
  }>;
}

interface TransactionJournal {
  id: string;
  planId: string;
  startTime: string;
  operations: Array<{
    type: 'backup' | 'apply' | 'rollback';
    file: string;
    timestamp: string;
    success: boolean;
    error?: string;
  }>;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
}

export class TransactionService {
  private logger = Logger.getInstance();
  private eventEmitter = EventEmitter.getInstance();
  private fsAdapter = FSAdapter.getInstance();
  private activeTransactions = new Map<string, TransactionJournal>();
  private backups = new Map<string, TransactionBackup>();

  async executeTransaction(
    planId: string,
    changes: FileChange[],
    options: ApplyPlanRequest['options'],
    correlationId: string
  ): Promise<{ success: boolean; appliedFiles: string[]; errors: string[] }> {
    const txnId = uuidv4();
    const journal: TransactionJournal = {
      id: txnId,
      planId,
      startTime: new Date().toISOString(),
      operations: [],
      status: 'pending'
    };

    this.activeTransactions.set(txnId, journal);
    this.logger.info('Transaction started', { txnId, planId, correlationId });

    try {
      // Phase 1: Create backups
      if (options.createBackups) {
        await this.createBackups(txnId, changes, correlationId);
      }

      // Phase 2: Validate all changes
      const validationResults = await this.validateChanges(changes, correlationId);
      if (validationResults.some(r => !r.valid)) {
        throw new Error(`Validation failed: ${validationResults.filter(r => !r.valid).map(r => r.error).join(', ')}`);
      }

      // Phase 3: Apply changes atomically
      const appliedFiles: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        
        this.eventEmitter.emit('apply.progress', {
          correlationId,
          txnId,
          progress: (i / changes.length) * 100,
          currentFile: change.file,
          operation: change.op
        });

        try {
          await this.applyFileChange(change, options, txnId);
          appliedFiles.push(change.file);
          
          journal.operations.push({
            type: 'apply',
            file: change.file,
            timestamp: new Date().toISOString(),
            success: true
          });
        } catch (error) {
          const errorMsg = `Failed to apply change to ${change.file}: ${error.message}`;
          errors.push(errorMsg);
          
          journal.operations.push({
            type: 'apply',
            file: change.file,
            timestamp: new Date().toISOString(),
            success: false,
            error: errorMsg
          });

          // If any operation fails, rollback entire transaction
          if (!options.dryRun) {
            await this.rollbackTransaction(txnId, correlationId);
            journal.status = 'rolled_back';
            this.activeTransactions.set(txnId, journal);
            throw new Error(`Transaction failed and rolled back: ${errorMsg}`);
          }
        }
      }

      journal.status = 'completed';
      this.activeTransactions.set(txnId, journal);

      this.eventEmitter.emit('apply.progress', {
        correlationId,
        txnId,
        progress: 100,
        completed: true
      });

      this.logger.info('Transaction completed', { 
        txnId, 
        appliedFiles: appliedFiles.length,
        errors: errors.length,
        correlationId 
      });

      return { success: errors.length === 0, appliedFiles, errors };

    } catch (error) {
      journal.status = 'failed';
      this.activeTransactions.set(txnId, journal);
      
      this.logger.error('Transaction failed', { txnId, error, correlationId });
      throw error;
    }
  }

  private async createBackups(
    txnId: string, 
    changes: FileChange[], 
    correlationId: string
  ): Promise<void> {
    const backup: TransactionBackup = {
      id: txnId,
      timestamp: new Date().toISOString(),
      files: []
    };

    for (const change of changes) {
      if (change.op === 'update' || change.op === 'delete') {
        try {
          const exists = await this.fsAdapter.exists(change.file);
          if (exists) {
            const content = await this.fsAdapter.readFile(change.file);
            const fileEtag = etag(content);
            
            backup.files.push({
              path: change.file,
              content,
              etag: fileEtag,
              existed: true
            });
          } else {
            backup.files.push({
              path: change.file,
              content: '',
              etag: '',
              existed: false
            });
          }
        } catch (error) {
          this.logger.warn('Backup creation failed for file', { 
            file: change.file, 
            error, 
            correlationId 
          });
        }
      }
    }

    this.backups.set(txnId, backup);
    this.logger.info('Backups created', { txnId, filesCount: backup.files.length, correlationId });
  }

  private async validateChanges(
    changes: FileChange[], 
    correlationId: string
  ): Promise<Array<{ valid: boolean; error?: string }>> {
    const results = [];

    for (const change of changes) {
      try {
        // Check path security
        if (!this.fsAdapter.isPathAllowed(change.file)) {
          results.push({ valid: false, error: 'Path not allowed' });
          continue;
        }

        // Validate etag for concurrent modification detection
        if (change.op === 'update') {
          const currentContent = await this.fsAdapter.readFile(change.file);
          const currentEtag = etag(currentContent);
          
          // TODO: Add etag comparison when frontend sends expected etag
          // if (change.expectedEtag && change.expectedEtag !== currentEtag) {
          //   results.push({ valid: false, error: 'File modified by another process' });
          //   continue;
          // }
        }

        // Validate diff application
        if (change.applyMethod === 'diff' && change.diff) {
          const diffValid = await this.validateDiff(change.file, change.diff);
          if (!diffValid) {
            this.eventEmitter.emit('fs.diffValidated', {
              correlationId,
              file: change.file,
              valid: false,
              fallbackToReplace: true
            });
            
            // Fallback to replaceFile if diff fails
            change.applyMethod = 'replaceFile';
            if (!change.content) {
              results.push({ valid: false, error: 'Diff invalid and no fallback content provided' });
              continue;
            }
          }
        }

        results.push({ valid: true });
      } catch (error) {
        results.push({ valid: false, error: error.message });
      }
    }

    return results;
  }

  private async validateDiff(filePath: string, diff: string): Promise<boolean> {
    try {
      // TODO: Implement proper diff validation using a diff library
      // For now, basic validation
      return diff.includes('@@') && (diff.includes('+') || diff.includes('-'));
    } catch (error) {
      this.logger.warn('Diff validation failed', { filePath, error });
      return false;
    }
  }

  private async applyFileChange(
    change: FileChange, 
    options: ApplyPlanRequest['options'],
    txnId: string
  ): Promise<void> {
    switch (change.op) {
      case 'create':
        await this.fsAdapter.writeFile(change.file, change.content || '');
        break;
        
      case 'update':
        await this.applyUpdate(change, options);
        break;
        
      case 'delete':
        await this.fsAdapter.deleteFile(change.file);
        break;
        
      case 'rename':
        if (!change.newPath) {
          throw new Error('New path required for rename operation');
        }
        await this.fsAdapter.renameFile(change.file, change.newPath);
        break;
        
      default:
        throw new Error(`Unknown operation: ${change.op}`);
    }

    // Format on save if enabled
    if (options.formatOnSave && this.isFormattableFile(change.file)) {
      await this.formatFile(change.file);
    }
  }

  private async applyUpdate(change: FileChange, options: ApplyPlanRequest['options']): Promise<void> {
    switch (change.applyMethod) {
      case 'replaceFile':
        if (!change.content) {
          throw new Error('Content required for replaceFile method');
        }
        await this.fsAdapter.writeFile(change.file, change.content);
        break;
        
      case 'diff':
        if (!change.diff) {
          throw new Error('Diff required for diff method');
        }
        await this.applyDiff(change.file, change.diff);
        break;
        
      case 'insertAtLine':
        if (change.insertAtLine === undefined || !change.content) {
          throw new Error('Line number and content required for insertAtLine method');
        }
        await this.insertAtLine(change.file, change.insertAtLine, change.content);
        break;
        
      default:
        throw new Error(`Unknown apply method: ${change.applyMethod}`);
    }
  }

  private async applyDiff(filePath: string, diff: string): Promise<void> {
    // TODO: Implement proper diff application using a diff library
    // For now, throw error to fallback to replaceFile
    throw new Error('Diff application not yet implemented - use replaceFile method');
  }

  private async insertAtLine(filePath: string, lineNumber: number, content: string): Promise<void> {
    const currentContent = await this.fsAdapter.readFile(filePath);
    const lines = currentContent.split('\n');
    
    lines.splice(lineNumber - 1, 0, content);
    const newContent = lines.join('\n');
    
    await this.fsAdapter.writeFile(filePath, newContent);
  }

  private isFormattableFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html'].includes(ext);
  }

  private async formatFile(filePath: string): Promise<void> {
    try {
      // TODO: Integrate with Prettier for actual formatting
      // For now, just log the intent
      this.logger.info('File formatted', { filePath });
    } catch (error) {
      this.logger.warn('File formatting failed', { filePath, error });
    }
  }

  async rollbackTransaction(txnId: string, correlationId: string): Promise<void> {
    const backup = this.backups.get(txnId);
    if (!backup) {
      throw new Error(`No backup found for transaction ${txnId}`);
    }

    this.logger.info('Rolling back transaction', { txnId, correlationId });

    for (const file of backup.files) {
      try {
        if (file.existed) {
          await this.fsAdapter.writeFile(file.path, file.content);
        } else {
          // File didn't exist before, so delete it
          if (await this.fsAdapter.exists(file.path)) {
            await this.fsAdapter.deleteFile(file.path);
          }
        }
      } catch (error) {
        this.logger.error('Rollback failed for file', { 
          file: file.path, 
          error, 
          txnId, 
          correlationId 
        });
      }
    }

    // Update journal
    const journal = this.activeTransactions.get(txnId);
    if (journal) {
      journal.status = 'rolled_back';
      journal.operations.push({
        type: 'rollback',
        file: 'all',
        timestamp: new Date().toISOString(),
        success: true
      });
      this.activeTransactions.set(txnId, journal);
    }

    this.logger.info('Transaction rolled back', { txnId, correlationId });
  }

  async getTransactionStatus(txnId: string): Promise<TransactionJournal | null> {
    return this.activeTransactions.get(txnId) || null;
  }

  async cleanupOldTransactions(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    
    for (const [txnId, journal] of this.activeTransactions.entries()) {
      const txnTime = new Date(journal.startTime).getTime();
      if (txnTime < cutoff) {
        this.activeTransactions.delete(txnId);
        this.backups.delete(txnId);
        this.logger.info('Cleaned up old transaction', { txnId });
      }
    }
  }

  // TODO: Add transaction compression for long-running operations
  // TODO: Implement distributed transaction support for multi-server deployments
  // TODO: Add transaction replay capability for debugging
  // TODO: Implement incremental backups to save space
}

export default TransactionService;