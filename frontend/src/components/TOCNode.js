import React, { useState } from 'react';
import { FaEdit, FaSave, FaTimes, FaSync } from 'react-icons/fa';

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
    const sections = [];
    
    lines.forEach((line, index) => {
      const sectionMatch = line.match(/^(#{2,4})\s+(.+?)(\(Node(?:s)?\s+\d+(?:-\d+)?\))$/);
      
      if (sectionMatch) {
        const [, hashes, title, nodeInfo] = sectionMatch;
        const level = hashes.length - 2; // Convert ## to 0, ### to 1, #### to 2
        sections.push({
          title: title.trim(),
          nodeInfo: nodeInfo.trim(),
          level,
          fullMatch: sectionMatch[0]
        });
      }
    });

    return (
      <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
        {sections.map((section, index) => (
          <div 
            key={index}
            onClick={() => handleSectionClick(section.fullMatch)}
            style={{
              cursor: 'pointer',
              padding: '6px 8px',
              marginLeft: `${section.level * 12}px`,
              color: 'var(--primary-color)',
              borderRadius: '4px',
              fontSize: section.level === 0 ? '14px' : '13px',
              fontWeight: section.level === 0 ? '500' : 'normal',
              transition: 'all 0.2s ease',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--hover-color)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <span>{section.title}</span>
            <span style={{ 
              color: 'var(--secondary-color)', 
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {section.nodeInfo.replace(/[()]/g, '')}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      style={{
        backgroundColor: 'var(--input-background)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        color: 'var(--primary-color)',
        maxWidth: '600px',
        margin: '0 auto 1.5rem auto'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.5rem'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1.1rem', 
          fontWeight: '600',
          color: 'var(--accent-color)'
        }}>Table of Contents</h3>
        
        {isOwner && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {!isEditing && !isEditMode && (
              <>
                <button
                  onClick={handleEdit}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    color: 'var(--secondary-color)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <FaEdit size={10} /> Edit
                </button>
                
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    color: 'var(--secondary-color)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: isRegenerating ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    opacity: isRegenerating ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <FaSync size={10} style={{ animation: isRegenerating ? 'spin 1s linear infinite' : 'none' }} />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </>
            )}
            
            {isEditing && (
              <>
                <button
                  onClick={handleSave}
                  style={{
                    background: 'var(--success-color)',
                    border: 'none',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  <FaSave size={10} />
                </button>
                
                <button
                  onClick={handleCancel}
                  style={{
                    background: 'var(--danger-color)',
                    border: 'none',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  <FaTimes size={10} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div>
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              width: '100%',
              height: '200px',
              padding: '0.75rem',
              backgroundColor: 'var(--background-color)',
              color: 'var(--primary-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              fontSize: '0.9rem',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.4'
            }}
          />
        ) : (
          <div style={{ lineHeight: '1.4' }}>
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