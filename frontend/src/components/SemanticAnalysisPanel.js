import React, { useState } from 'react';
import { FaChevronDown, FaChevronRight, FaClock, FaTag, FaStar, FaBook, FaBrain, FaEye } from 'react-icons/fa';
import './SemanticAnalysisPanel.css';

function SemanticAnalysisPanel({ analysis, onNavigateToSegment, isVisible, onToggle }) {
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [activeTab, setActiveTab] = useState('overview');

  if (!analysis) {
    return null;
  }

  const toggleSection = (sectionIndex) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionIndex)) {
      newExpanded.delete(sectionIndex);
    } else {
      newExpanded.add(sectionIndex);
    }
    setExpandedSections(newExpanded);
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const getImportanceColor = (level) => {
    switch (level) {
      case 'primary': return '#2563eb';
      case 'secondary': return '#7c3aed';
      case 'supporting': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getComplexityIcon = (level) => {
    switch (level) {
      case 'beginner': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🟠';
      case 'expert': return '🔴';
      default: return '⚪';
    }
  };

  const renderTableOfContents = () => {
    const renderSection = (section, index, depth = 0) => {
      const isExpanded = expandedSections.has(`${depth}-${index}`);
      const hasSubsections = section.subsections && section.subsections.length > 0;
      
      return (
        <div key={`${depth}-${index}`} className="toc-section" style={{ marginLeft: `${depth * 1}rem` }}>
          <div 
            className="toc-section-header"
            onClick={() => {
              if (hasSubsections) {
                toggleSection(`${depth}-${index}`);
              }
              // Navigate to first segment in this section
              if (section.segment_indices && section.segment_indices.length > 0) {
                onNavigateToSegment(section.segment_indices[0]);
              }
            }}
          >
            {hasSubsections && (
              <span className="toc-toggle">
                {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
              </span>
            )}
            <span className="toc-title">{section.title}</span>
            <span className="toc-time">
              <FaClock size={10} /> {formatTime(section.estimated_read_time)}
            </span>
          </div>
          
          {section.summary && (
            <div className="toc-summary">{section.summary}</div>
          )}
          
          {hasSubsections && isExpanded && (
            <div className="toc-subsections">
              {section.subsections.map((subsection, subIndex) => 
                renderSection(subsection, subIndex, depth + 1)
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="table-of-contents">
        {analysis.table_of_contents.map((section, index) => 
          renderSection(section, index)
        )}
      </div>
    );
  };

  const renderSegmentsList = () => {
    return (
      <div className="segments-list">
        {analysis.segments.map((segment, index) => (
          <div 
            key={segment.id}
            className="segment-item"
            onClick={() => onNavigateToSegment(index)}
          >
            <div className="segment-header">
              <div 
                className="segment-importance"
                style={{ backgroundColor: getImportanceColor(segment.importance_level) }}
              />
              <span className="segment-title">{segment.title}</span>
              <span className="segment-time">
                <FaClock size={10} /> {formatTime(segment.estimated_reading_time)}
              </span>
            </div>
            
            <div className="segment-summary">{segment.summary}</div>
            
            {segment.topic_keywords && segment.topic_keywords.length > 0 && (
              <div className="segment-keywords">
                {segment.topic_keywords.slice(0, 3).map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">
                    <FaTag size={8} /> {keyword}
                  </span>
                ))}
              </div>
            )}
            
            <div className="segment-meta">
              <span className="coherence-score">
                Coherence: {Math.round(segment.semantic_coherence_score * 100)}%
              </span>
              <span className="segment-length">
                {segment.length} chars
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOverview = () => {
    return (
      <div className="analysis-overview">
        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon">
              <FaBook />
            </div>
            <div className="overview-content">
              <h4>Document Type</h4>
              <p>{analysis.document_type.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          
          <div className="overview-card">
            <div className="overview-icon">
              <FaClock />
            </div>
            <div className="overview-content">
              <h4>Reading Time</h4>
              <p>{formatTime(analysis.estimated_total_read_time)}</p>
            </div>
          </div>
          
          <div className="overview-card">
            <div className="overview-icon">
              {getComplexityIcon(analysis.complexity_level)}
            </div>
            <div className="overview-content">
              <h4>Complexity</h4>
              <p>{analysis.complexity_level.toUpperCase()}</p>
            </div>
          </div>
          
          <div className="overview-card">
            <div className="overview-icon">
              <FaBrain />
            </div>
            <div className="overview-content">
              <h4>Coherence</h4>
              <p>{Math.round(analysis.overall_coherence_score * 100)}%</p>
            </div>
          </div>
        </div>
        
        <div className="overview-summary">
          <h4>Summary</h4>
          <p>{analysis.overall_summary}</p>
        </div>
        
        <div className="overview-themes">
          <h4>Main Themes</h4>
          <div className="themes-list">
            {analysis.main_themes.map((theme, index) => (
              <span key={index} className="theme-tag">{theme}</span>
            ))}
          </div>
        </div>
        
        <div className="overview-audience">
          <h4>Target Audience</h4>
          <p>{analysis.target_audience}</p>
        </div>
        
        {analysis.processing_time_seconds && (
          <div className="processing-info">
            <small>
              Analysis completed in {analysis.processing_time_seconds}s using {analysis.openai_model_used}
            </small>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`semantic-analysis-panel ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="panel-header">
        <h3>
          <FaEye /> Document Analysis
        </h3>
        <button className="toggle-button" onClick={onToggle}>
          {isVisible ? 'Hide' : 'Show'}
        </button>
      </div>
      
      {isVisible && (
        <div className="panel-content">
          <div className="panel-tabs">
            <button 
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`tab ${activeTab === 'toc' ? 'active' : ''}`}
              onClick={() => setActiveTab('toc')}
            >
              Table of Contents
            </button>
            <button 
              className={`tab ${activeTab === 'segments' ? 'active' : ''}`}
              onClick={() => setActiveTab('segments')}
            >
              Segments ({analysis.segments.length})
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'toc' && renderTableOfContents()}
            {activeTab === 'segments' && renderSegmentsList()}
          </div>
        </div>
      )}
    </div>
  );
}

export default SemanticAnalysisPanel;
