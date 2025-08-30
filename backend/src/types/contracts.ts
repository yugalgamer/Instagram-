import { z } from 'zod';

// Base schemas
export const FileChangeSchema = z.object({
  file: z.string(),
  op: z.enum(['create', 'update', 'delete', 'rename']),
  applyMethod: z.enum(['diff', 'replaceFile', 'insertAtLine']),
  diff: z.string().optional(),
  content: z.string().optional(),
  newPath: z.string().optional(), // for rename operations
  insertAtLine: z.number().optional(),
  backup: z.boolean().default(true)
});

export const PlanStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['analyze', 'generate', 'modify', 'test', 'deploy']),
  dependencies: z.array(z.string()).default([]),
  estimatedTime: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending')
});

export const AIResponseSchema = z.object({
  id: z.string(),
  summary: z.string(),
  reasoning: z.string(),
  plan: z.object({
    steps: z.array(PlanStepSchema),
    estimatedDuration: z.string().optional()
  }),
  changes: z.array(FileChangeSchema),
  notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  metadata: z.object({
    model: z.string(),
    tokens: z.number().optional(),
    processingTime: z.number(),
    confidence: z.number().min(0).max(1).optional()
  })
});

export const PromptRequestSchema = z.object({
  prompt: z.string(),
  context: z.object({
    currentFile: z.string().optional(),
    openFiles: z.array(z.string()).default([]),
    selectedText: z.string().optional(),
    cursorPosition: z.object({
      line: z.number(),
      column: z.number()
    }).optional(),
    projectType: z.string().optional(),
    framework: z.string().optional()
  }).optional(),
  modes: z.object({
    dryRun: z.boolean().default(true),
    maxFilesChanged: z.number().default(10),
    requireConfirmation: z.boolean().default(true),
    formatOnSave: z.boolean().default(true),
    createBackups: z.boolean().default(true)
  }).default({}),
  idempotencyKey: z.string().optional()
});

export const ApplyPlanRequestSchema = z.object({
  planId: z.string(),
  selectedFiles: z.array(z.string()).optional(), // if not provided, apply all
  options: z.object({
    createBackups: z.boolean().default(true),
    formatOnSave: z.boolean().default(true),
    dryRun: z.boolean().default(false)
  }).default({})
});

export const BuildStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['idle', 'building', 'success', 'failed']),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  duration: z.number().optional(),
  output: z.string().optional(),
  errors: z.array(z.object({
    file: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info'])
  })).default([]),
  artifacts: z.object({
    distPath: z.string().optional(),
    previewUrl: z.string().optional(),
    size: z.number().optional()
  }).optional()
});

export const ErrorModelSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  correlationId: z.string(),
  timestamp: z.string().datetime(),
  stack: z.string().optional()
});

export const FileMetadataSchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
  lastModified: z.string().datetime(),
  etag: z.string(),
  mimeType: z.string().optional(),
  permissions: z.object({
    read: z.boolean(),
    write: z.boolean(),
    execute: z.boolean()
  }).optional()
});

export const FileTreeSchema = z.object({
  path: z.string(),
  metadata: FileMetadataSchema,
  children: z.array(z.lazy(() => FileTreeSchema)).optional()
});

export const StreamEventSchema = z.object({
  type: z.enum([
    'ai.started',
    'ai.token', 
    'ai.completed',
    'fs.diffValidated',
    'apply.progress',
    'build.status',
    'error'
  ]),
  data: z.record(z.any()),
  correlationId: z.string(),
  timestamp: z.string().datetime()
});

// Export types
export type FileChange = z.infer<typeof FileChangeSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type PromptRequest = z.infer<typeof PromptRequestSchema>;
export type ApplyPlanRequest = z.infer<typeof ApplyPlanRequestSchema>;
export type BuildStatus = z.infer<typeof BuildStatusSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
export type FileMetadata = z.infer<typeof FileMetadataSchema>;
export type FileTree = z.infer<typeof FileTreeSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;

// Validation helpers
export const validatePromptRequest = (data: unknown) => PromptRequestSchema.parse(data);
export const validateAIResponse = (data: unknown) => AIResponseSchema.parse(data);
export const validateApplyPlanRequest = (data: unknown) => ApplyPlanRequestSchema.parse(data);
export const validateBuildStatus = (data: unknown) => BuildStatusSchema.parse(data);
export const validateStreamEvent = (data: unknown) => StreamEventSchema.parse(data);