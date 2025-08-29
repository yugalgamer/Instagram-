import React, { useState } from 'react';
import { Code2, Terminal, MessageSquare, FileText, Settings, Search, GitBranch } from 'lucide-react';
import Sidebar from './components/Sidebar';
import CodeEditor from './components/CodeEditor';
import TerminalComponent from './components/Terminal';
import AIChat from './components/AIChat';
import './App.css';

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  content?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('welcome.md');
  const [openFiles, setOpenFiles] = useState<string[]>(['welcome.md']);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showAIChat, setShowAIChat] = useState(true);
  const [files, setFiles] = useState<FileNode[]>([
    {
      name: 'src',
      type: 'folder',
      path: '/src',
      children: [
        { name: 'App.tsx', type: 'file', path: '/src/App.tsx', content: '// VedxBuilder Main App\nimport React from "react";\n\nfunction App() {\n  return (\n    <div>\n      <h1>Welcome to VedxBuilder!</h1>\n    </div>\n  );\n}\n\nexport default App;' },
        { name: 'index.tsx', type: 'file', path: '/src/index.tsx', content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);' },
        { name: 'components', type: 'folder', path: '/src/components', children: [] }
      ]
    },
    { name: 'package.json', type: 'file', path: '/package.json', content: '{\n  "name": "vedx-project",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0"\n  }\n}' },
    { name: 'README.md', type: 'file', path: '/README.md', content: '# VedxBuilder Project\n\nWelcome to your new VedxBuilder workspace!\n\n## Features\n- Modern code editor with AI assistance\n- Integrated terminal and codespace\n- Smart autocomplete and suggestions\n- Real-time collaboration\n\nStart coding and let VedxBuilder help you build amazing projects!' },
    { name: 'welcome.md', type: 'file', path: '/welcome.md', content: '# Welcome to VedxBuilder! 🚀\n\n**VedxBuilder** is your intelligent coding companion, designed to make development faster, smarter, and more enjoyable.\n\n## Key Features\n\n### 🤖 AI-Powered Development\n- Smart code completions and suggestions\n- Natural language to code conversion\n- Intelligent debugging assistance\n- Code optimization recommendations\n\n### 💻 Modern Development Environment\n- Full-featured code editor with syntax highlighting\n- Integrated terminal and command line\n- File explorer and project management\n- Multiple language support\n\n### ☁️ Codespace Integration\n- Cloud-based development environment\n- Instant project setup and deployment\n- Collaborative coding features\n- Version control integration\n\n## Getting Started\n\n1. **Explore the File Explorer** - Browse your project files in the sidebar\n2. **Start Coding** - Open any file and begin editing with intelligent assistance\n3. **Use the Terminal** - Run commands, install packages, and manage your project\n4. **Chat with AI** - Ask questions, get help, and generate code using the AI assistant\n\n## Quick Tips\n\n- Use `Ctrl+P` to quickly open files\n- Press `Ctrl+J` to toggle the terminal\n- Use `Ctrl+Shift+P` for the command palette\n- Chat with AI using natural language for instant help\n\n---\n\n*Ready to build something amazing? Let\'s get started!* ✨' }
  ]);

  const openFile = (filePath: string) => {
    if (!openFiles.includes(filePath)) {
      setOpenFiles([...openFiles, filePath]);
    }
    setActiveTab(filePath);
  };

  const closeFile = (filePath: string) => {
    const newOpenFiles = openFiles.filter(f => f !== filePath);
    setOpenFiles(newOpenFiles);
    
    if (activeTab === filePath) {
      setActiveTab(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : '');
    }
  };

  const getFileContent = (filePath: string): string => {
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === filePath) return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const file = findFile(files);
    return file?.content || '';
  };

  const updateFileContent = (filePath: string, content: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === filePath) {
          return { ...node, content };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    
    setFiles(updateNode(files));
  };

  return (
    <div className="vedx-container">
      <Sidebar 
        files={files} 
        onFileSelect={openFile}
      />
      
      <div className="vedx-main">
        <div className="vedx-header">
          <div className="vedx-logo">
            <Code2 size={16} />
            <span>VedxBuilder</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>v1.0.0</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="vedx-button"
              onClick={() => setShowTerminal(!showTerminal)}
              title="Toggle Terminal"
            >
              <Terminal size={14} />
            </button>
            <button 
              className="vedx-button"
              onClick={() => setShowAIChat(!showAIChat)}
              title="Toggle AI Chat"
            >
              <MessageSquare size={14} />
            </button>
            <button className="vedx-button" title="Settings">
              <Settings size={14} />
            </button>
          </div>
        </div>

        <div className="vedx-content">
          <div className="vedx-editor-area">
            {openFiles.length > 0 && (
              <div className="vedx-tabs">
                {openFiles.map(filePath => (
                  <div 
                    key={filePath}
                    className={`vedx-tab ${activeTab === filePath ? 'active' : ''}`}
                    onClick={() => setActiveTab(filePath)}
                  >
                    <FileText size={12} />
                    <span>{filePath.split('/').pop()}</span>
                    <button 
                      className="vedx-tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(filePath);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <CodeEditor 
              content={getFileContent(activeTab)}
              filePath={activeTab}
              onChange={(content) => updateFileContent(activeTab, content)}
            />
          </div>
          
          {showAIChat && (
            <AIChat />
          )}
        </div>

        {showTerminal && (
          <TerminalComponent />
        )}
      </div>
    </div>
  );
}

export default App;