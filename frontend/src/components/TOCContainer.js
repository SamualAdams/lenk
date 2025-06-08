import React, { useState } from 'react';
import { FaSync, FaBookOpen } from 'react-icons/fa';
import TOCSection from './TOCSection';

function TOCContainer({ 
  cognition, 
  isOwner, 
  onNavigateToNode, 
  onRegenerateTOC 
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  const handleUpdateSection = async (sectionIndex, updatedSection) => {
    // For now, this would require a backend endpoint to update individual sections
    // We could implement this later if needed
    console.log('Update section:', sectionIndex, updatedSection);
  };

  const sections = cognition.table_of_contents?.sections || [];

  if (!sections.length) {
    return (
      <div style={{
        backgroundColor: 'var(--input-background)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--secondary-color)',
        marginBottom: '1.5rem'
      }}>
        <FaBookOpen size={24} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>No table of contents available</p>
        {isOwner && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            style={{
              background: 'var(--accent-color)',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: isRegenerating ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              marginTop: '1rem',
              opacity: isRegenerating ? 0.6 : 1
            }}
          >
            {isRegenerating ? 'Generating...' : 'Generate TOC'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: '1.5rem',
      maxWidth: '600px',
      margin: '0 auto 1.5rem auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1.1rem', 
          fontWeight: '600',
          color: 'var(--accent-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <FaBookOpen size={16} />
          Table of Contents
        </h3>

        {isOwner && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              color: 'var(--secondary-color)',
              padding: '0.5rem 0.75rem',
              borderRadius: '4px',
              cursor: isRegenerating ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              opacity: isRegenerating ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FaSync size={10} style={{ animation: isRegenerating ? 'spin 1s linear infinite' : 'none' }} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        )}
      </div>

      {/* Section Cards */}
      <div>
        {sections.map((section, index) => (
          <TOCSection
            key={index}
            section={section}
            index={index}
            isOwner={isOwner}
            onNavigateToNode={onNavigateToNode}
            onUpdateSection={handleUpdateSection}
          />
        ))}
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

export default TOCContainer;