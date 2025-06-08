import React, { useState } from 'react';
import { FaEdit, FaSave, FaTimes, FaSync } from 'react-icons/fa';
import MarkdownRenderer from './MarkdownRenderer';

function TOCNode({ 
  node, 
  cognition, 
  isOwner, 
  isEditMode, 
  onNavigateToNode, 
  onRegenerateTOC, 
  onUpdateTOCContent 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.content);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(node.content);
  };

  const handleSave = async () => {
    if (onUpdateTOCContent) {
      await onUpdateTOCContent(node.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(node.content);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('This will completely regenerate the TOC from current nodes. Continue?')) {
      return;
    }
    
    setIsRegenerating(true);
    try {
      if (onRegenerateTOC) {
        await onRegenerateTOC();
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSectionClick = (sectionMatch) => {
    const nodeRangeMatch = sectionMatch.match(/\(Node(?:s)? (\d+)(?:-(\d+))?\)/);
    if (nodeRangeMatch) {
      const startNode = parseInt(nodeRangeMatch[1]);
      if (onNavigateToNode) {
        onNavigateToNode(startNode);
      }
    }
  };

  const renderInteractiveTOC = (content) => {
    const lines = content.split('\n');
    const processedLines = lines.map((line, index) => {
      const sectionMatch = line.match(/^(#{2,4})\s+(.+?)(\(Node(?:s)?\s+\d+(?:-\d+)?\))$/);
      
      if (sectionMatch) {
        const [, hashes, title, nodeInfo] = sectionMatch;
        return (
          <div 
            key={index}
            className="toc-section-link"
            onClick={() => handleSectionClick(sectionMatch[0])}
            style={{
              cursor: 'pointer',
              padding: '0.25rem 0',
              borderRadius: '3px',
              transition: 'background-color 0.15s ease',
              fontSize: hashes.length === 2 ? '1.1rem' : hashes.length === 3 ? '1rem' : '0.9rem',
              fontWeight: hashes.length === 2 ? '600' : '500',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--hover-color, #f5f5f5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            {title} <span style={{ color: 'var(--secondary-color, #666)', fontSize: '0.85rem' }}>{nodeInfo}</span>
          </div>
        );
      }
      
      return (
        <div key={index}>
          <MarkdownRenderer content={line} />
        </div>
      );
    });

    return <div>{processedLines}</div>;
  };

  return (
    <div 
      style={{
        border: '1px solid var(--border-color, #ddd)',
        borderRadius: '6px',
        padding: '1rem',
        margin: '0.5rem 0',
        backgroundColor: 'var(--card-bg, #fff)',
        fontSize: '0.9rem',
        maxWidth: '400px', // Fixed width to prevent timeline impact
        minHeight: '200px', // Fixed minimum height
        maxHeight: '400px', // Fixed maximum height
        overflow: 'auto'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        borderBottom: '1px solid var(--border-color, #eee)',
        paddingBottom: '0.5rem'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1rem', 
          fontWeight: '500'
        }}>
          Table of Contents
        </h3>
        
        {isOwner && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isEditing && !isEditMode && (
              <>
                <button
                  onClick={handleEdit}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color, #ddd)',
                    color: 'var(--text-color, #333)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <FaEdit size={10} />
                  Edit
                </button>
                
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color, #ddd)',
                    color: 'var(--text-color, #333)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: isRegenerating ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    opacity: isRegenerating ? 0.6 : 1
                  }}
                >
                  <FaSync 
                    size={10} 
                    style={{ 
                      animation: isRegenerating ? 'spin 1s linear infinite' : 'none' 
                    }} 
                  />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </>
            )}
            
            {isEditing && (
              <>
                <button
                  onClick={handleSave}
                  style={{
                    background: '#4caf50',
                    border: 'none',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <FaSave size={10} />
                  Save
                </button>
                
                <button
                  onClick={handleCancel}
                  style={{
                    background: '#f44336',
                    border: 'none',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <FaTimes size={10} />
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '0.5rem',
              border: '1px solid var(--border-color, #ddd)',
              borderRadius: '3px',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit'
            }}
            placeholder="Edit table of contents..."
          />
        ) : (
          <div style={{
            lineHeight: '1.4',
            fontSize: '0.85rem'
          }}>
            {renderInteractiveTOC(node.content)}
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default TOCNode;