import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Maximize2, Copy, Download, MoreHorizontal } from 'lucide-react';

interface CodeEditorProps {
  content: string;
  filePath: string;
  onChange: (content: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ content, filePath, onChange }) => {
  const editorRef = useRef<any>(null);

  const getLanguage = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'php': 'php',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'sh': 'shell',
      'bash': 'shell'
    };
    
    return languageMap[extension || ''] || 'plaintext';
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Define VedxBuilder theme
    monaco.editor.defineTheme('vedx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'class', foreground: '4ec9b0' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'variable', foreground: '9cdcfe' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editor.lineHighlightBackground': '#2d2d30',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editorCursor.foreground': '#ffffff',
        'editorWhitespace.foreground': '#404040',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
      }
    });
    
    monaco.editor.setTheme('vedx-dark');
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      console.log('Save file:', filePath);
    });
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 13,
      fontFamily: 'Fira Code, Consolas, Monaco, monospace',
      lineHeight: 20,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      }
    });
  };

  const copyContent = () => {
    navigator.clipboard.writeText(content);
  };

  const downloadFile = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!filePath) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
        color: 'var(--text-secondary)',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem', opacity: 0.5 }}>
          📝
        </div>
        <h2 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>
          Welcome to VedxBuilder
        </h2>
        <p style={{ maxWidth: '400px', lineHeight: 1.6 }}>
          Select a file from the explorer to start editing, or create a new file to begin your project.
        </p>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button className="vedx-button">
            Create New File
          </button>
          <button className="vedx-button">
            Open Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Editor toolbar */}
      <div style={{
        height: '32px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px'
      }}>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{getLanguage(filePath).toUpperCase()}</span>
          <span>•</span>
          <span>UTF-8</span>
          <span>•</span>
          <span>LF</span>
        </div>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="vedx-button" 
            style={{ padding: '4px' }}
            onClick={copyContent}
            title="Copy content"
          >
            <Copy size={12} />
          </button>
          <button 
            className="vedx-button" 
            style={{ padding: '4px' }}
            onClick={downloadFile}
            title="Download file"
          >
            <Download size={12} />
          </button>
          <button 
            className="vedx-button" 
            style={{ padding: '4px' }}
            title="More options"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Editor
          height="100%"
          language={getLanguage(filePath)}
          value={content}
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            theme: 'vedx-dark',
            fontSize: 13,
            fontFamily: 'Fira Code, Consolas, Monaco, monospace',
            lineHeight: 20,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true
            },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            parameterHints: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            formatOnType: true
          }}
        />
      </div>

      {/* Status bar */}
      <div style={{
        height: '20px',
        backgroundColor: 'var(--accent-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: '11px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
          <span>{getLanguage(filePath)}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span>VedxBuilder</span>
          <span>AI Ready</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;