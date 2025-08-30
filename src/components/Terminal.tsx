import React, { useEffect, useRef, useState } from 'react';
import { 
  Terminal as TerminalIcon, 
  X, 
  Plus, 
  ChevronDown,
  Square,
  RotateCcw,
  Settings
} from 'lucide-react';
import { VedxAPI } from '../services/api';

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [terminals, setTerminals] = useState([
    { id: 0, name: 'Terminal 1', cwd: '/workspace' }
  ]);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([
    'Welcome to VedxBuilder Terminal! 🚀',
    'Type "help" for available commands or start coding!',
    ''
  ]);

  // Execute terminal commands via backend API
  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) return;
    
    setCommandHistory(prev => [...prev, `$ ${trimmedCmd}`]);
    
    try {
      // Use real backend API
      const result = await VedxAPI.executeCommand(trimmedCmd, terminals[activeTab]?.cwd || '/workspace');
      
      // Update current working directory if changed
      if (result.cwd !== terminals[activeTab]?.cwd) {
        setTerminals(prev => prev.map(t => 
          t.id === activeTab ? { ...t, cwd: result.cwd } : t
        ));
      }
      
      // Handle special commands
      if (trimmedCmd.toLowerCase() === 'clear') {
        setCommandHistory([]);
        return;
      }
      
      // Add command output
      if (result.output) {
        setCommandHistory(prev => [...prev, result.output, '']);
      }
      
      // Show exit code if non-zero
      if (result.exitCode !== 0) {
        setCommandHistory(prev => [...prev, `Exit code: ${result.exitCode}`, '']);
      }
      
    } catch (error) {
      console.error('Terminal command error:', error);
      setCommandHistory(prev => [...prev, 
        `Error: Failed to execute command '${trimmedCmd}'`,
        'Check if VedxBuilder backend is running on port 3001',
        ''
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(command);
      setCommand('');
    }
  };

  const addNewTerminal = () => {
    const newId = Math.max(...terminals.map(t => t.id)) + 1;
    setTerminals([...terminals, { 
      id: newId, 
      name: `Terminal ${newId + 1}`, 
      cwd: '/workspace' 
    }]);
    setActiveTab(newId);
  };

  const closeTerminal = (id: number) => {
    if (terminals.length > 1) {
      const newTerminals = terminals.filter(t => t.id !== id);
      setTerminals(newTerminals);
      if (activeTab === id) {
        setActiveTab(newTerminals[0].id);
      }
    }
  };

  const clearTerminal = () => {
    setCommandHistory([]);
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)'
    }}>
      {/* Terminal Header */}
      <div style={{
        height: '35px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={14} />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Terminal</span>
        </div>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="vedx-button"
            style={{ padding: '4px' }}
            onClick={addNewTerminal}
            title="New Terminal"
          >
            <Plus size={12} />
          </button>
          <button 
            className="vedx-button"
            style={{ padding: '4px' }}
            onClick={clearTerminal}
            title="Clear Terminal"
          >
            <RotateCcw size={12} />
          </button>
          <button 
            className="vedx-button"
            style={{ padding: '4px' }}
            title="Terminal Settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Tabs */}
      {terminals.length > 1 && (
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`vedx-tab ${activeTab === terminal.id ? 'active' : ''}`}
              onClick={() => setActiveTab(terminal.id)}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              <TerminalIcon size={10} />
              <span>{terminal.name}</span>
              {terminals.length > 1 && (
                <button
                  className="vedx-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(terminal.id);
                  }}
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Terminal Content */}
      <div style={{ 
        flex: 1, 
        padding: '8px',
        fontFamily: 'Fira Code, Consolas, Monaco, monospace',
        fontSize: '12px',
        lineHeight: '1.4',
        overflow: 'auto',
        backgroundColor: '#0c0c0c'
      }}>
        {/* Command History */}
        <div style={{ marginBottom: '8px' }}>
          {commandHistory.map((line, index) => (
            <div key={index} style={{ 
              color: line.startsWith('$') ? 'var(--accent-blue)' : 'var(--text-primary)',
              fontWeight: line.startsWith('$') ? 600 : 400,
              whiteSpace: 'pre-wrap'
            }}>
              {line}
            </div>
          ))}
        </div>

        {/* Command Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
            vedx@workspace:~$
          </span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            placeholder="Type a command..."
            autoFocus
          />
        </div>
      </div>

      {/* Terminal Footer */}
      <div style={{
        height: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: '10px',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span>bash</span>
          <span>UTF-8</span>
          <span>{terminals.find(t => t.id === activeTab)?.cwd}</span>
        </div>
        <div>
          <span>VedxBuilder Terminal v1.0</span>
        </div>
      </div>
    </div>
  );
};

export default Terminal;