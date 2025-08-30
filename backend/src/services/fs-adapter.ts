import { promises as fs } from 'fs';
import path from 'path';
import etag from 'etag';
import { FileMetadata, FileTree } from '../types/contracts.js';
import { Logger } from '../utils/logger.js';

export class FSAdapter {
  private static instance: FSAdapter;
  private logger = Logger.getInstance();
  private workspaceRoot: string;
  private allowedPaths: Set<string>;

  private constructor() {
    this.workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd();
    
    // TODO: Load allowed paths from configuration
    this.allowedPaths = new Set([
      'src/',
      'public/',
      'components/',
      'pages/',
      'styles/',
      'utils/',
      'hooks/',
      'services/',
      'types/',
      'tests/',
      '__tests__/',
      'docs/',
      'README.md',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'tailwind.config.js',
      '.env.example'
    ]);
  }

  static getInstance(): FSAdapter {
    if (!FSAdapter.instance) {
      FSAdapter.instance = new FSAdapter();
    }
    return FSAdapter.instance;
  }

  isPathAllowed(filePath: string): boolean {
    // Security check - prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
      return false;
    }

    // Check against whitelist
    return Array.from(this.allowedPaths).some(allowedPath => 
      normalizedPath.startsWith(allowedPath) || normalizedPath === allowedPath
    );
  }

  private getAbsolutePath(filePath: string): string {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Path not allowed: ${filePath}`);
    }
    return path.join(this.workspaceRoot, filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const absolutePath = this.getAbsolutePath(filePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const absolutePath = this.getAbsolutePath(filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      this.logger.debug('File read', { filePath, size: content.length });
      return content;
    } catch (error) {
      this.logger.error('Failed to read file', { filePath, error });
      throw new Error(`Failed to read file: ${filePath}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const absolutePath = this.getAbsolutePath(filePath);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      
      // Write file atomically
      const tempPath = `${absolutePath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, absolutePath);
      
      this.logger.info('File written', { filePath, size: content.length });
    } catch (error) {
      this.logger.error('Failed to write file', { filePath, error });
      throw new Error(`Failed to write file: ${filePath}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const absolutePath = this.getAbsolutePath(filePath);
      await fs.unlink(absolutePath);
      this.logger.info('File deleted', { filePath });
    } catch (error) {
      this.logger.error('Failed to delete file', { filePath, error });
      throw new Error(`Failed to delete file: ${filePath}`);
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      const absoluteOldPath = this.getAbsolutePath(oldPath);
      const absoluteNewPath = this.getAbsolutePath(newPath);
      
      // Ensure target directory exists
      await fs.mkdir(path.dirname(absoluteNewPath), { recursive: true });
      
      await fs.rename(absoluteOldPath, absoluteNewPath);
      this.logger.info('File renamed', { oldPath, newPath });
    } catch (error) {
      this.logger.error('Failed to rename file', { oldPath, newPath, error });
      throw new Error(`Failed to rename file: ${oldPath} -> ${newPath}`);
    }
  }

  async getFileMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const absolutePath = this.getAbsolutePath(filePath);
      const stats = await fs.stat(absolutePath);
      const content = stats.isFile() ? await fs.readFile(absolutePath, 'utf-8') : '';
      
      return {
        path: filePath,
        name: path.basename(filePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        etag: etag(content),
        mimeType: this.getMimeType(filePath),
        permissions: {
          read: true, // TODO: Check actual permissions
          write: true,
          execute: stats.isFile() && (stats.mode & 0o111) !== 0
        }
      };
    } catch (error) {
      this.logger.error('Failed to get file metadata', { filePath, error });
      throw new Error(`Failed to get metadata for: ${filePath}`);
    }
  }

  async getFileTree(rootPath: string = '', maxDepth: number = 5): Promise<FileTree> {
    if (maxDepth <= 0) {
      throw new Error('Maximum depth reached');
    }

    const absolutePath = rootPath ? this.getAbsolutePath(rootPath) : this.workspaceRoot;
    const relativePath = rootPath || '.';
    
    try {
      const metadata = await this.getFileMetadata(relativePath);
      const tree: FileTree = { path: relativePath, metadata };

      if (metadata.type === 'directory') {
        const entries = await fs.readdir(absolutePath);
        const children: FileTree[] = [];

        for (const entry of entries) {
          // Skip hidden files and node_modules
          if (entry.startsWith('.') || entry === 'node_modules') {
            continue;
          }

          const childPath = rootPath ? `${rootPath}/${entry}` : entry;
          
          if (this.isPathAllowed(childPath)) {
            try {
              const childTree = await this.getFileTree(childPath, maxDepth - 1);
              children.push(childTree);
            } catch (error) {
              this.logger.warn('Failed to read child path', { childPath, error });
            }
          }
        }

        tree.children = children.sort((a, b) => {
          // Directories first, then files
          if (a.metadata.type !== b.metadata.type) {
            return a.metadata.type === 'directory' ? -1 : 1;
          }
          return a.metadata.name.localeCompare(b.metadata.name);
        });
      }

      return tree;
    } catch (error) {
      this.logger.error('Failed to build file tree', { rootPath, error });
      throw new Error(`Failed to read directory: ${rootPath}`);
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.jsx': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.scss': 'text/scss',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif'
    };
    
    return mimeTypes[ext] || 'text/plain';
  }

  async batchOperation(operations: Array<{
    type: 'read' | 'write' | 'delete';
    path: string;
    content?: string;
  }>): Promise<Array<{ success: boolean; error?: string; content?: string }>> {
    const results = [];

    for (const op of operations) {
      try {
        switch (op.type) {
          case 'read':
            const content = await this.readFile(op.path);
            results.push({ success: true, content });
            break;
            
          case 'write':
            await this.writeFile(op.path, op.content || '');
            results.push({ success: true });
            break;
            
          case 'delete':
            await this.deleteFile(op.path);
            results.push({ success: true });
            break;
            
          default:
            results.push({ success: false, error: 'Unknown operation type' });
        }
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  // TODO: Add file watching capabilities with chokidar
  // TODO: Implement file locking for concurrent access
  // TODO: Add compression for large files
  // TODO: Implement file versioning and history
  // TODO: Add sandbox isolation for untrusted operations
}

export default FSAdapter;