import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Search, 
  GitBranch, 
  Settings,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw
} from 'lucide-react';
import { FileNode } from '../App';

interface SidebarProps {
  files: FileNode[];
  onFileSelect: (filePath: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ files, onFileSelect }) => {
  const [activeSection, setActiveSection] = useState<'explorer' | 'search' | 'git' | 'settings'>('explorer');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/src']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path} style={{ marginLeft: `${depth * 12}px` }}>
        <div 
          className="file-item"
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            gap: '6px',
            borderRadius: '3px',
            margin: '1px 0'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {node.type === 'folder' ? (
            <>
              {expandedFolders.has(node.path) ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              {expandedFolders.has(node.path) ? (
                <FolderOpen size={14} color="var(--accent-blue)" />
              ) : (
                <Folder size={14} color="var(--accent-blue)" />
              )}
            </>
          ) : (
            <>
              <span style={{ width: '12px' }} />
              <FileText size={14} color="var(--text-secondary)" />
            </>
          )}
          <span>{node.name}</span>
        </div>
        
        {node.type === 'folder' && expandedFolders.has(node.path) && node.children && (
          <div>
            {renderFileTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  const sidebarSections = [
    { id: 'explorer', icon: Folder, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="vedx-sidebar">
      {/* Sidebar Navigation */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)'
      }}>
        {sidebarSections.map((section) => (
          <button
            key={section.id}
            className={`vedx-button ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id as any)}
            style={{
              border: 'none',
              borderRadius: 0,
              padding: '12px',
              backgroundColor: activeSection === section.id ? 'var(--bg-primary)' : 'transparent',
              borderRight: activeSection === section.id ? '2px solid var(--accent-blue)' : 'none'
            }}
            title={section.label}
          >
            <section.icon size={16} />
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, padding: '8px', overflow: 'auto' }}>
        {activeSection === 'explorer' && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px',
              padding: '4px 0'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Explorer
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="vedx-button" style={{ padding: '2px' }} title="New File">
                  <Plus size={12} />
                </button>
                <button className="vedx-button" style={{ padding: '2px' }} title="Refresh">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
            
            <div style={{ fontSize: '12px' }}>
              {renderFileTree(files)}
            </div>
          </div>
        )}

        {activeSection === 'search' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Search
              </span>
            </div>
            <input
              type="text"
              className="vedx-input"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', marginBottom: '8px' }}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {searchQuery ? `Searching for "${searchQuery}"...` : 'Enter search term to find files'}
            </div>
          </div>
        )}

        {activeSection === 'git' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Source Control
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ color: 'var(--accent-green)' }}>● main</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>No changes</div>
              </div>
              
              <button className="vedx-button" style={{ width: '100%', marginBottom: '4px' }}>
                Commit Changes
              </button>
              <button className="vedx-button" style={{ width: '100%' }}>
                Sync Changes
              </button>
            </div>
          </div>
        )}

        {activeSection === 'settings' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Settings
              </span>
            </div>
            <div style={{ fontSize: '12px' }}>
              <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Theme</div>
                <select className="vedx-input" style={{ width: '100%' }}>
                  <option>Dark Theme</option>
                  <option>Light Theme</option>
                  <option>High Contrast</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Font Size</div>
                <input type="range" min="10" max="20" defaultValue="13" style={{ width: '100%' }} />
              </div>
              
              <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" defaultChecked />
                  Enable AI Assistance
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;