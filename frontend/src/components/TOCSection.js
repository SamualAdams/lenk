import React, { useState } from 'react';
import { FaEdit, FaSave, FaTimes } from 'react-icons/fa';

function TOCSection({ 
  section, 
  index,
  isOwner, 
  onNavigateToNode, 
  onUpdateSection 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(section.title);
  };

  const handleSave = async () => {
    if (onUpdateSection) {
      await onUpdateSection(index, { ...section, title: editTitle });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(section.title);
  };

  const handleClick = () => {
    if (!isEditing && onNavigateToNode) {
      onNavigateToNode(section.start_node);
    }
  };

  const nodeRange = section.start_node === section.end_node 
    ? `Node ${section.start_node}` 
    : `Nodes ${section.start_node}-${section.end_node}`;

  return (
    <div 
      style={{
        backgroundColor: 'var(--input-background)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '0.5rem',
        cursor: isEditing ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '60px'
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isEditing) {
          e.target.style.backgroundColor = 'var(--hover-color)';
          e.target.style.borderColor = 'var(--accent-color)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isEditing) {
          e.target.style.backgroundColor = 'var(--input-background)';
          e.target.style.borderColor = 'var(--border-color)';
        }
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--background-color)',
              border: '1px solid var(--border-color)',
              color: 'var(--primary-color)',
              padding: '0.5rem',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '500',
              outline: 'none'
            }}
            autoFocus
          />
        ) : (
          <h4 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: '500',
            color: 'var(--primary-color)',
            lineHeight: '1.3'
          }}>
            {section.title}
          </h4>
        )}
        
        <div style={{
          fontSize: '0.85rem',
          color: 'var(--secondary-color)',
          fontFamily: 'monospace'
        }}>
          {nodeRange}
        </div>
      </div>

      {isOwner && (
        <div 
          style={{ 
            display: 'flex', 
            gap: '0.5rem',
            marginLeft: '1rem'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                style={{
                  background: 'var(--success-color)',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FaSave size={12} />
              </button>
              
              <button
                onClick={handleCancel}
                style={{
                  background: 'var(--danger-color)',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FaTimes size={12} />
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                color: 'var(--secondary-color)',
                padding: '0.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <FaEdit size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TOCSection;