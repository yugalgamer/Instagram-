import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Plus, 
  Minus,
  Eye,
  Play,
  AlertTriangle,
  Info
} from 'lucide-react';
import { AIResponse, FileChange } from '../services/vedx-api';
import clsx from 'clsx';

interface PlanReviewProps {
  plan: AIResponse;
  onApply: (selectedFiles: string[], options: any) => Promise<void>;
  onCancel: () => void;
  isApplying?: boolean;
}

const PlanReview: React.FC<PlanReviewProps> = ({ 
  plan, 
  onApply, 
  onCancel, 
  isApplying = false 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(
    new Set(plan.changes.map(c => c.file))
  );
  const [showDiff, setShowDiff] = useState<string | null>(null);
  const [applyOptions, setApplyOptions] = useState({
    createBackups: true,
    formatOnSave: true,
    dryRun: false
  });

  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const selectAll = () => {
    setSelectedFiles(new Set(plan.changes.map(c => c.file)));
  };

  const selectNone = () => {
    setSelectedFiles(new Set());
  };

  const handleApply = async () => {
    await onApply(Array.from(selectedFiles), applyOptions);
  };

  const getFileIcon = (change: FileChange) => {
    switch (change.op) {
      case 'create': return <Plus className="w-4 h-4 text-vedx-accent-green" />;
      case 'update': return <FileText className="w-4 h-4 text-vedx-accent-blue" />;
      case 'delete': return <Minus className="w-4 h-4 text-vedx-accent-red" />;
      case 'rename': return <FileText className="w-4 h-4 text-vedx-accent-yellow" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getOperationBadge = (op: string) => {
    const colors = {
      create: 'bg-vedx-accent-green/20 text-vedx-accent-green border-vedx-accent-green/30',
      update: 'bg-vedx-accent-blue/20 text-vedx-accent-blue border-vedx-accent-blue/30',
      delete: 'bg-vedx-accent-red/20 text-vedx-accent-red border-vedx-accent-red/30',
      rename: 'bg-vedx-accent-yellow/20 text-vedx-accent-yellow border-vedx-accent-yellow/30'
    };
    
    return (
      <span className={clsx(
        'px-2 py-1 text-xs font-medium rounded border',
        colors[op as keyof typeof colors] || 'bg-gray-500/20 text-gray-400'
      )}>
        {op.toUpperCase()}
      </span>
    );
  };

  const renderDiffViewer = (change: FileChange) => {
    if (!change.diff && !change.content) return null;

    return (
      <div className="mt-4 bg-vedx-tertiary rounded-lg border border-vedx-border">
        <div className="px-4 py-2 border-b border-vedx-border flex items-center justify-between">
          <span className="text-sm font-medium">Changes Preview</span>
          <button
            onClick={() => setShowDiff(null)}
            className="text-vedx-text-muted hover:text-vedx-text-primary"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4">
          {change.applyMethod === 'diff' && change.diff ? (
            <pre className="text-xs font-mono bg-vedx-primary p-3 rounded overflow-x-auto">
              {change.diff}
            </pre>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-vedx-text-secondary">
                Method: {change.applyMethod}
                {change.insertAtLine && ` (Line ${change.insertAtLine})`}
              </div>
              <pre className="text-xs font-mono bg-vedx-primary p-3 rounded overflow-x-auto max-h-64">
                {change.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-vedx-secondary border border-vedx-border rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-vedx-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-vedx-text-primary">
                Review AI Plan
              </h2>
              <p className="text-sm text-vedx-text-secondary mt-1">
                {plan.summary}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-vedx-text-muted">
                {plan.metadata.model} • {plan.metadata.processingTime}ms
              </span>
              {plan.metadata.confidence && (
                <span className="text-xs bg-vedx-accent-blue/20 text-vedx-accent-blue px-2 py-1 rounded">
                  {Math.round(plan.metadata.confidence * 100)}% confidence
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Plan Overview */}
          <div className="w-1/3 border-r border-vedx-border p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Reasoning */}
              <div>
                <h3 className="text-sm font-medium text-vedx-text-primary mb-2">
                  Reasoning
                </h3>
                <p className="text-xs text-vedx-text-secondary leading-relaxed">
                  {plan.reasoning}
                </p>
              </div>

              {/* Steps */}
              <div>
                <h3 className="text-sm font-medium text-vedx-text-primary mb-2">
                  Plan Steps
                </h3>
                <div className="space-y-2">
                  {plan.plan.steps.map((step, index) => (
                    <div 
                      key={step.id}
                      className="flex items-start gap-2 p-2 bg-vedx-tertiary rounded border border-vedx-border"
                    >
                      <span className="text-xs bg-vedx-accent-blue text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-vedx-text-primary font-medium">
                          {step.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-vedx-text-muted capitalize">
                            {step.type}
                          </span>
                          {step.estimatedTime && (
                            <span className="text-xs text-vedx-text-muted">
                              • {step.estimatedTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings & Notes */}
              {(plan.warnings.length > 0 || plan.notes.length > 0) && (
                <div className="space-y-2">
                  {plan.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-vedx-accent-red/10 border border-vedx-accent-red/30 rounded">
                      <AlertTriangle className="w-4 h-4 text-vedx-accent-red flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-vedx-accent-red">{warning}</span>
                    </div>
                  ))}
                  
                  {plan.notes.map((note, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-vedx-accent-blue/10 border border-vedx-accent-blue/30 rounded">
                      <Info className="w-4 h-4 text-vedx-accent-blue flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-vedx-accent-blue">{note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - File Changes */}
          <div className="flex-1 flex flex-col">
            {/* File Selection Header */}
            <div className="p-4 border-b border-vedx-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-vedx-text-primary">
                  File Changes ({plan.changes.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-vedx-accent-blue hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-vedx-text-muted">•</span>
                  <button
                    onClick={selectNone}
                    className="text-xs text-vedx-accent-blue hover:underline"
                  >
                    Select None
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-vedx-text-secondary">
                {selectedFiles.size} of {plan.changes.length} files selected
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {plan.changes.map((change) => (
                <div key={change.file} className="border border-vedx-border rounded-lg overflow-hidden">
                  <div 
                    className={clsx(
                      'p-3 cursor-pointer transition-colors',
                      selectedFiles.has(change.file) 
                        ? 'bg-vedx-accent-blue/10 border-l-2 border-l-vedx-accent-blue' 
                        : 'bg-vedx-tertiary hover:bg-vedx-hover'
                    )}
                    onClick={() => toggleFileSelection(change.file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(change.file)}
                          onChange={() => toggleFileSelection(change.file)}
                          className="w-4 h-4 text-vedx-accent-blue bg-vedx-tertiary border-vedx-border rounded focus:ring-vedx-accent-blue"
                        />
                        {getFileIcon(change)}
                        <div>
                          <div className="text-sm font-medium text-vedx-text-primary">
                            {change.file}
                          </div>
                          <div className="text-xs text-vedx-text-secondary">
                            {change.applyMethod}
                            {change.newPath && ` → ${change.newPath}`}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getOperationBadge(change.op)}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDiff(showDiff === change.file ? null : change.file);
                          }}
                          className="p-1 hover:bg-vedx-hover rounded"
                          title="View changes"
                        >
                          <Eye className="w-4 h-4 text-vedx-text-muted" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {showDiff === change.file && renderDiffViewer(change)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-vedx-border bg-vedx-tertiary">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={applyOptions.createBackups}
                    onChange={(e) => setApplyOptions(prev => ({ ...prev, createBackups: e.target.checked }))}
                    className="w-3 h-3"
                  />
                  Create backups
                </label>
                
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={applyOptions.formatOnSave}
                    onChange={(e) => setApplyOptions(prev => ({ ...prev, formatOnSave: e.target.checked }))}
                    className="w-3 h-3"
                  />
                  Format on save
                </label>
                
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={applyOptions.dryRun}
                    onChange={(e) => setApplyOptions(prev => ({ ...prev, dryRun: e.target.checked }))}
                    className="w-3 h-3"
                  />
                  Dry run only
                </label>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                disabled={isApplying}
                className="px-4 py-2 text-sm bg-vedx-tertiary border border-vedx-border text-vedx-text-primary rounded hover:bg-vedx-hover disabled:opacity-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleApply}
                disabled={selectedFiles.size === 0 || isApplying}
                className={clsx(
                  'px-4 py-2 text-sm rounded flex items-center gap-2',
                  'bg-vedx-accent-blue text-white hover:bg-vedx-accent-blue/80',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Apply Changes ({selectedFiles.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanReview;