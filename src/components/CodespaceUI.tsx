import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle,
  CheckCircle,
  Clock,
  Monitor,
  Code2,
  Eye
} from 'lucide-react';
import VedxAPI from '../services/vedx-api';
import clsx from 'clsx';

interface BuildError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface BuildStatus {
  id: string;
  status: 'idle' | 'building' | 'success' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: number;
  output?: string;
  errors: BuildError[];
  artifacts?: {
    distPath?: string;
    previewUrl?: string;
    size?: number;
  };
}

const CodespaceUI: React.FC = () => {
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showBuildOutput, setShowBuildOutput] = useState(false);
  const [buildHistory, setBuildHistory] = useState<BuildStatus[]>([]);

  useEffect(() => {
    // Initial build status check
    loadBuildStatus();
    
    // Listen to build events via WebSocket
    VedxAPI.connectWebSocket().then(() => {
      VedxAPI.onStreamEvent('build.status', handleBuildEvent);
    }).catch(console.error);

    return () => {
      VedxAPI.offStreamEvent('build.status', handleBuildEvent);
    };
  }, []);

  const loadBuildStatus = async () => {
    try {
      const status = await VedxAPI.getBuildStatus();
      setBuildStatus(status);
      setIsBuilding(status?.status === 'building');
    } catch (error) {
      console.error('Failed to load build status:', error);
    }
  };

  const handleBuildEvent = (event: any) => {
    const { buildId, status, duration, errors, artifacts } = event.data;
    
    setBuildStatus(prev => prev ? {
      ...prev,
      status,
      duration,
      errors: errors || prev.errors,
      artifacts: artifacts || prev.artifacts
    } : null);
    
    setIsBuilding(status === 'building');
    
    if (status === 'success' || status === 'failed') {
      // Add to history
      setBuildHistory(prev => [
        { 
          id: buildId, 
          status, 
          duration, 
          errors: errors || [],
          artifacts,
          endTime: new Date().toISOString()
        },
        ...prev.slice(0, 9) // Keep last 10 builds
      ]);
    }
  };

  const triggerBuild = async () => {
    try {
      setIsBuilding(true);
      const buildId = await VedxAPI.triggerBuild();
      
      setBuildStatus({
        id: buildId,
        status: 'building',
        startTime: new Date().toISOString(),
        errors: []
      });
    } catch (error) {
      console.error('Failed to trigger build:', error);
      setIsBuilding(false);
    }
  };

  const openPreview = async () => {
    try {
      const preview = await VedxAPI.getPreviewURL();
      setPreviewUrl(preview.url);
      window.open(preview.url, '_blank');
    } catch (error) {
      console.error('Failed to open preview:', error);
    }
  };

  const getStatusIcon = (status: BuildStatus['status']) => {
    switch (status) {
      case 'building':
        return <RefreshCw className="w-4 h-4 text-vedx-accent-blue animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-vedx-accent-green" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-vedx-accent-red" />;
      default:
        return <Clock className="w-4 h-4 text-vedx-text-muted" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="h-full bg-vedx-secondary border-l border-vedx-border flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-vedx-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-vedx-accent-blue" />
            <span className="text-sm font-medium text-vedx-text-primary">Codespace</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={triggerBuild}
              disabled={isBuilding}
              className={clsx(
                'px-3 py-1.5 text-xs rounded flex items-center gap-1.5',
                'bg-vedx-accent-blue text-white hover:bg-vedx-accent-blue/80',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isBuilding ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Build
                </>
              )}
            </button>
            
            {buildStatus?.status === 'success' && (
              <button
                onClick={openPreview}
                className="px-3 py-1.5 text-xs rounded flex items-center gap-1.5 bg-vedx-accent-green text-white hover:bg-vedx-accent-green/80"
              >
                <ExternalLink className="w-3 h-3" />
                Preview
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current Build Status */}
      {buildStatus && (
        <div className="p-4 border-b border-vedx-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(buildStatus.status)}
              <span className="text-sm font-medium text-vedx-text-primary capitalize">
                {buildStatus.status}
              </span>
            </div>
            
            {buildStatus.duration && (
              <span className="text-xs text-vedx-text-muted">
                {formatDuration(buildStatus.duration)}
              </span>
            )}
          </div>

          {buildStatus.status === 'building' && (
            <div className="w-full bg-vedx-tertiary rounded-full h-2 mb-2">
              <div className="bg-vedx-accent-blue h-2 rounded-full animate-pulse w-1/2"></div>
            </div>
          )}

          {buildStatus.artifacts && (
            <div className="text-xs text-vedx-text-secondary space-y-1">
              {buildStatus.artifacts.size && (
                <div>Bundle size: {formatFileSize(buildStatus.artifacts.size)}</div>
              )}
              {buildStatus.artifacts.previewUrl && (
                <div>Preview: {buildStatus.artifacts.previewUrl}</div>
              )}
            </div>
          )}

          {buildStatus.errors.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowBuildOutput(!showBuildOutput)}
                className="text-xs text-vedx-accent-red hover:underline flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {buildStatus.errors.length} error(s)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Build Output/Errors */}
      {showBuildOutput && buildStatus?.errors.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 bg-vedx-primary">
          <div className="space-y-2">
            {buildStatus.errors.map((error, index) => (
              <div 
                key={index}
                className={clsx(
                  'p-3 rounded border text-xs',
                  error.severity === 'error' && 'bg-vedx-accent-red/10 border-vedx-accent-red/30 text-vedx-accent-red',
                  error.severity === 'warning' && 'bg-vedx-accent-orange/10 border-vedx-accent-orange/30 text-vedx-accent-orange',
                  error.severity === 'info' && 'bg-vedx-accent-blue/10 border-vedx-accent-blue/30 text-vedx-accent-blue'
                )}
              >
                <div className="font-medium mb-1">
                  {error.file}
                  {error.line && `:${error.line}`}
                  {error.column && `:${error.column}`}
                </div>
                <div className="font-mono text-xs opacity-90">
                  {error.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Build History */}
      {!showBuildOutput && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-vedx-text-primary mb-2">
              Recent Builds
            </h3>
          </div>
          
          <div className="space-y-2">
            {buildHistory.length === 0 ? (
              <div className="text-center py-8 text-vedx-text-muted">
                <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No builds yet</p>
                <p className="text-xs">Click "Build" to start</p>
              </div>
            ) : (
              buildHistory.map((build) => (
                <div 
                  key={build.id}
                  className="p-3 bg-vedx-tertiary border border-vedx-border rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(build.status)}
                      <span className="text-xs font-medium text-vedx-text-primary capitalize">
                        {build.status}
                      </span>
                    </div>
                    
                    {build.endTime && (
                      <span className="text-xs text-vedx-text-muted">
                        {new Date(build.endTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-vedx-text-secondary">
                    {build.duration && `Duration: ${formatDuration(build.duration)}`}
                    {build.errors.length > 0 && (
                      <span className="text-vedx-accent-red ml-2">
                        {build.errors.length} error(s)
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-vedx-border bg-vedx-tertiary">
        <div className="flex items-center justify-between text-xs text-vedx-text-muted">
          <span>VedxBuilder Codespace</span>
          <div className="flex items-center gap-2">
            <Code2 className="w-3 h-3" />
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodespaceUI;