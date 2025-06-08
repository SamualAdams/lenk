import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import './InputMode.css';
import { FaStar, FaRegStar, FaTrashAlt, FaCopy, FaBookOpen, FaClock, FaEye, FaFileAlt, FaCheckSquare, FaSquare, FaEdit, FaShareAlt, FaGlobe, FaSave, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

function InputMode() {
  const { currentUser } = useAuth();
  const [cognitions, setCognitions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [showNewCognitionModal, setShowNewCognitionModal] = useState(false);
  const [newCognitionText, setNewCognitionText] = useState('');
  const [creatingCognition, setCreatingCognition] = useState(false);
  
  // Bulk operations state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedCognitions, setSelectedCognitions] = useState(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  
  // Title editing state
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [titleInput, setTitleInput] = useState('');

  useEffect(() => {
    fetchCognitions();
  }, []);

  const fetchCognitions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/cognitions/');
      setCognitions(response.data);
    } catch (err) {
      setError('Failed to load cognitions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCognition = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this cognition?')) return;
    try {
      await axiosInstance.delete(`/cognitions/${id}/`);
      setCognitions(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Failed to delete cognition.');
    }
  };

  const handleDuplicateCognition = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const original = cognitions.find(c => c.id === id);
      if (!original) return;
      const duplicateData = { ...original };
      delete duplicateData.id;
      duplicateData.title = original.title + ' (Copy)';
      const response = await axiosInstance.post('/cognitions/', duplicateData);
      setCognitions(prev => [...prev, response.data]);
    } catch {
      alert('Failed to duplicate cognition.');
    }
  };

  const handleStarCognition = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const cognition = cognitions.find(c => c.id === id);
      if (!cognition) return;
      const updated = { ...cognition, is_starred: !cognition.is_starred };
      await axiosInstance.put(`/cognitions/${id}/`, updated);
      setCognitions(prev => prev.map(c => (c.id === id ? updated : c)));
    } catch {
      alert('Failed to update star status.');
    }
  };

  const handleNewCognitionClick = () => {
    setShowNewCognitionModal(true);
  };

  const handleCreateCognition = async () => {
    setCreatingCognition(true);
    try {
      // Create the cognition with initial text
      const response = await axiosInstance.post('/cognitions/', {
        title: 'Untitled Cognition',
        raw_content: newCognitionText,
        is_starred: false,
      });
      
      // Always try semantic segmentation first for any substantial text
      if (newCognitionText.length > 100) {
        try {
          console.log('Processing text with AI semantic segmentation...');
          await axiosInstance.post(`/cognitions/${response.data.id}/quick_segment/`, {
            create_nodes: true,
            max_segments: 20
          });
          console.log('AI segmentation completed successfully');
        } catch (semanticError) {
          console.warn('AI segmentation failed, falling back to basic processing:', semanticError);
          // Note: process_text now has built-in AI segmentation fallback
          await axiosInstance.post(`/cognitions/${response.data.id}/process_text/`);
        }
      } else {
        // Use basic processing for very short text
        await axiosInstance.post(`/cognitions/${response.data.id}/process_text/`);
      }
      
      setCognitions(prev => [...prev, response.data]);
      setShowNewCognitionModal(false);
      setNewCognitionText('');
      navigate(`/cognition/${response.data.id}`);
    } catch (err) {
      alert('Failed to create new cognition.');
    } finally {
      setCreatingCognition(false);
    }
  };


  const handleCollectiveClick = () => {
    navigate('/collective');
  };

  // Bulk Operations Handlers
  const toggleBulkSelectMode = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedCognitions(new Set());
  };

  const toggleCognitionSelection = (cognitionId) => {
    const newSelected = new Set(selectedCognitions);
    if (newSelected.has(cognitionId)) {
      newSelected.delete(cognitionId);
    } else {
      newSelected.add(cognitionId);
    }
    setSelectedCognitions(newSelected);
  };

  const selectAllCognitions = () => {
    const allIds = new Set(cognitions.map(c => c.id));
    setSelectedCognitions(allIds);
  };

  const clearSelection = () => {
    setSelectedCognitions(new Set());
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCognitions.size} cognitions? This cannot be undone.`)) {
      return;
    }
    
    setBulkActionInProgress(true);
    try {
      const deletePromises = Array.from(selectedCognitions).map(id => 
        axiosInstance.delete(`/cognitions/${id}/`)
      );
      await Promise.all(deletePromises);
      
      setCognitions(prev => prev.filter(c => !selectedCognitions.has(c.id)));
      setSelectedCognitions(new Set());
      setBulkSelectMode(false);
      alert(`Successfully deleted ${selectedCognitions.size} cognitions`);
    } catch (err) {
      alert('Failed to delete some cognitions. Please try again.');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleBulkStar = async () => {
    setBulkActionInProgress(true);
    try {
      const starPromises = Array.from(selectedCognitions).map(async (id) => {
        const cognition = cognitions.find(c => c.id === id);
        if (cognition && !cognition.is_starred) {
          return axiosInstance.post(`/cognitions/${id}/star/`);
        }
        return Promise.resolve();
      });
      await Promise.all(starPromises);
      
      setCognitions(prev => prev.map(c => 
        selectedCognitions.has(c.id) ? { ...c, is_starred: true } : c
      ));
      setSelectedCognitions(new Set());
      setBulkSelectMode(false);
      alert(`Successfully starred ${selectedCognitions.size} cognitions`);
    } catch (err) {
      alert('Failed to star some cognitions. Please try again.');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleBulkShareToCollective = async () => {
    if (!window.confirm(`Share ${selectedCognitions.size} cognitions to the collective? They will become publicly visible.`)) {
      return;
    }
    
    setBulkActionInProgress(true);
    try {
      const sharePromises = Array.from(selectedCognitions).map(async (id) => {
        const cognition = cognitions.find(c => c.id === id);
        if (cognition && !cognition.is_public) {
          return axiosInstance.post(`/cognitions/${id}/toggle_share/`);
        }
        return Promise.resolve();
      });
      await Promise.all(sharePromises);
      
      setCognitions(prev => prev.map(c => 
        selectedCognitions.has(c.id) ? { ...c, is_public: true } : c
      ));
      setSelectedCognitions(new Set());
      setBulkSelectMode(false);
      alert(`Successfully shared ${selectedCognitions.size} cognitions to collective`);
    } catch (err) {
      alert('Failed to share some cognitions. Please try again.');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  // Single cognition share handler
  const handleShareToCollective = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const cognition = cognitions.find(c => c.id === id);
    if (!cognition) return;
    
    const action = cognition.is_public ? 'remove from' : 'share to';
    if (!window.confirm(`${action} collective?`)) return;
    
    try {
      await axiosInstance.post(`/cognitions/${id}/toggle_share/`);
      setCognitions(prev => prev.map(c => 
        c.id === id ? { ...c, is_public: !c.is_public } : c
      ));
    } catch {
      alert('Failed to update sharing status.');
    }
  };

  // Title editing handlers
  const handleTitleEdit = (cognition, e) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingTitleId(cognition.id);
    setTitleInput(cognition.title);
  };

  const handleTitleSave = async (cognitionId, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!titleInput.trim()) {
      alert('Title cannot be empty');
      return;
    }
    
    try {
      await axiosInstance.patch(`/cognitions/${cognitionId}/`, { title: titleInput.trim() });
      setCognitions(prev => prev.map(c => 
        c.id === cognitionId ? { ...c, title: titleInput.trim() } : c
      ));
      setEditingTitleId(null);
      setTitleInput('');
    } catch (err) {
      alert('Failed to update title.');
    }
  };

  const handleTitleCancel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingTitleId(null);
    setTitleInput('');
  };

  // Utility Functions
  const calculateReadingTime = (cognition) => {
    // Try to use backend-calculated reading time first
    if (cognition.estimated_reading_time) {
      return Math.ceil(cognition.estimated_reading_time / 60); // Convert seconds to minutes
    }
    
    // Fallback: calculate from node count
    const nodeCount = cognition.nodes_count || cognition.nodes?.length || 0;
    if (nodeCount > 0) {
      const avgReadingTimePerNode = 30; // seconds
      const totalSeconds = nodeCount * avgReadingTimePerNode;
      return Math.ceil(totalSeconds / 60);
    }
    
    // Final fallback: calculate from raw content
    if (cognition.raw_content) {
      const wordsPerMinute = 200;
      const wordCount = cognition.raw_content.split(/\s+/).length;
      return Math.ceil(wordCount / wordsPerMinute);
    }
    
    return 1; // Minimum 1 minute
  };

  const formatLastModified = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getTOCInfo = (cognition) => {
    // For list view, we need to check table_of_contents field since nodes aren't included
    let hasTOC = false;
    let sectionCount = 0;
    
    if (cognition.table_of_contents) {
      if (Array.isArray(cognition.table_of_contents) && cognition.table_of_contents.length > 0) {
        hasTOC = true;
        sectionCount = cognition.table_of_contents.length;
      } else if (cognition.table_of_contents.sections && cognition.table_of_contents.sections.length > 0) {
        hasTOC = true;
        sectionCount = cognition.table_of_contents.sections.length;
      }
    }
    
    return { hasTOC, sectionCount };
  };

  const starredCognitions = cognitions.filter(c => c.is_starred);
  const unstarredCognitions = cognitions.filter(c => !c.is_starred);

  return (
    <div className="input-mode vertical-layout">
      <main className="mobile-network">
        <div className="cognition-grid">
          {isLoading && !cognitions.length ? (
            <div className="loading">Loading cognitions...</div>
          ) : error && !cognitions.length ? (
            <p className="error-message">{error}</p>
          ) : cognitions.length === 0 ? (
            <div className="empty-state">
              <FaFileAlt className="empty-icon" />
              <p className="empty-message">No cognitions found</p>
              <p className="empty-subtitle">Create your first cognition to get started</p>
            </div>
          ) : (
            <>
              {/* Starred Cognitions */}
              {starredCognitions.length > 0 && (
                <div className="starred-section">
                  <h2 className="section-title">Starred</h2>
                  <div className="cognition-cards">
                    {starredCognitions.map(cognition => {
                      const { hasTOC, sectionCount } = getTOCInfo(cognition);
                      const isOwner = (cognition.username && cognition.username === currentUser?.username) || (cognition.user && cognition.user === currentUser?.id);
                      const nodeCount = cognition.nodes_count || cognition.nodes?.length || 0;
                      const readingTime = calculateReadingTime(cognition);
                      
                      return (
                        <div key={cognition.id} className="cognition-card starred">
                          <Link to={`/cognition/${cognition.id}`} className="card-content">
                            <div className="card-header">
                              {editingTitleId === cognition.id ? (
                                <div className="title-edit-container" onClick={(e) => e.preventDefault()}>
                                  <input
                                    type="text"
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="title-input"
                                    autoFocus
                                  />
                                  <div className="title-actions">
                                    <button
                                      onClick={(e) => handleTitleSave(cognition.id, e)}
                                      className="title-btn save"
                                      title="Save"
                                    >
                                      <FaSave />
                                    </button>
                                    <button
                                      onClick={(e) => handleTitleCancel(e)}
                                      className="title-btn cancel"
                                      title="Cancel"
                                    >
                                      <FaTimes />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="title-display">
                                  <h3 className="card-title">{cognition.title}</h3>
                                  <button
                                    onClick={(e) => handleTitleEdit(cognition, e)}
                                    className="edit-title-btn"
                                    title="Edit title"
                                  >
                                    <FaEdit />
                                  </button>
                                </div>
                              )}
                              <div className="card-badges">
                                <FaStar className="star-badge" />
                                {hasTOC && (
                                  <div className="toc-badge" title={`${sectionCount} sections`}>
                                    <FaBookOpen />
                                    <span>{sectionCount}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="card-metadata">
                              <div className="metadata-item">
                                <FaFileAlt className="metadata-icon" />
                                <span>{nodeCount} nodes</span>
                              </div>
                              <div className="metadata-item">
                                <FaClock className="metadata-icon" />
                                <span>{readingTime} min read</span>
                              </div>
                              <div className="metadata-item">
                                <FaEye className="metadata-icon" />
                                <span>{formatLastModified(cognition.updated_at)}</span>
                              </div>
                            </div>
                          </Link>
                          
                          {isOwner && (
                            <div className="card-actions">
                              {bulkSelectMode ? (
                                <button 
                                  className="action-btn select"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleCognitionSelection(cognition.id);
                                  }}
                                  title={selectedCognitions.has(cognition.id) ? "Deselect" : "Select"}
                                >
                                  {selectedCognitions.has(cognition.id) ? <FaCheckSquare /> : <FaSquare />}
                                </button>
                              ) : (
                                <>
                                  <button className="action-btn duplicate" onClick={(e) => handleDuplicateCognition(cognition.id, e)} title="Duplicate">
                                    <FaCopy />
                                  </button>
                                  <button className="action-btn share" onClick={(e) => handleShareToCollective(cognition.id, e)} title={cognition.is_public ? "Remove from collective" : "Share to collective"}>
                                    {cognition.is_public ? <FaGlobe /> : <FaShareAlt />}
                                  </button>
                                  <button className="action-btn star" onClick={(e) => handleStarCognition(cognition.id, e)} title="Unstar">
                                    <FaStar />
                                  </button>
                                  <button className="action-btn delete" onClick={(e) => handleDeleteCognition(cognition.id, e)} title="Delete">
                                    <FaTrashAlt />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* All Cognitions */}
              <div className="all-section">
                <div className="section-header">
                  <h2 className="section-title">All Cognitions</h2>
                  <div className="section-actions">
                    <button 
                      className={`bulk-select-btn ${bulkSelectMode ? 'active' : ''}`}
                      onClick={toggleBulkSelectMode}
                      title={bulkSelectMode ? "Exit bulk select" : "Bulk select"}
                    >
                      <FaEdit />
                      {bulkSelectMode ? 'Cancel' : 'Select'}
                    </button>
                  </div>
                </div>
                
                {/* Bulk Actions Bar */}
                {bulkSelectMode && (
                  <div className="bulk-actions-bar">
                    <div className="bulk-info">
                      <span>{selectedCognitions.size} selected</span>
                      {selectedCognitions.size > 0 && (
                        <>
                          <button className="bulk-action-link" onClick={selectAllCognitions}>Select All</button>
                          <button className="bulk-action-link" onClick={clearSelection}>Clear</button>
                        </>
                      )}
                    </div>
                    
                    {selectedCognitions.size > 0 && (
                      <div className="bulk-actions">
                        <button 
                          className="bulk-action-btn star"
                          onClick={handleBulkStar}
                          disabled={bulkActionInProgress}
                          title="Star selected"
                        >
                          <FaStar />
                        </button>
                        <button 
                          className="bulk-action-btn share"
                          onClick={handleBulkShareToCollective}
                          disabled={bulkActionInProgress}
                          title="Share to collective"
                        >
                          <FaShareAlt />
                        </button>
                        <button 
                          className="bulk-action-btn delete"
                          onClick={handleBulkDelete}
                          disabled={bulkActionInProgress}
                          title="Delete selected"
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="cognition-cards">
                  {unstarredCognitions.map(cognition => {
                    const { hasTOC, sectionCount } = getTOCInfo(cognition);
                    const isOwner = (cognition.username && cognition.username === currentUser?.username) || (cognition.user && cognition.user === currentUser?.id);
                    const nodeCount = cognition.nodes_count || cognition.nodes?.length || 0;
                    const readingTime = calculateReadingTime(cognition);
                    
                    return (
                      <div key={cognition.id} className="cognition-card">
                        <Link to={`/cognition/${cognition.id}`} className="card-content">
                          <div className="card-header">
                            {editingTitleId === cognition.id ? (
                              <div className="title-edit-container" onClick={(e) => e.preventDefault()}>
                                <input
                                  type="text"
                                  value={titleInput}
                                  onChange={(e) => setTitleInput(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="title-input"
                                  autoFocus
                                />
                                <div className="title-actions">
                                  <button
                                    onClick={(e) => handleTitleSave(cognition.id, e)}
                                    className="title-btn save"
                                    title="Save"
                                  >
                                    <FaSave />
                                  </button>
                                  <button
                                    onClick={(e) => handleTitleCancel(e)}
                                    className="title-btn cancel"
                                    title="Cancel"
                                  >
                                    <FaTimes />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="title-display">
                                <h3 className="card-title">{cognition.title}</h3>
                                <button
                                  onClick={(e) => handleTitleEdit(cognition, e)}
                                  className="edit-title-btn"
                                  title="Edit title"
                                >
                                  <FaEdit />
                                </button>
                              </div>
                            )}
                            <div className="card-badges">
                              {hasTOC && (
                                <div className="toc-badge" title={`${sectionCount} sections`}>
                                  <FaBookOpen />
                                  <span>{sectionCount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="card-metadata">
                            <div className="metadata-item">
                              <FaFileAlt className="metadata-icon" />
                              <span>{nodeCount} nodes</span>
                            </div>
                            <div className="metadata-item">
                              <FaClock className="metadata-icon" />
                              <span>{readingTime} min read</span>
                            </div>
                            <div className="metadata-item">
                              <FaEye className="metadata-icon" />
                              <span>{formatLastModified(cognition.updated_at)}</span>
                            </div>
                          </div>
                        </Link>
                        
                        {isOwner && (
                          <div className="card-actions">
                            {bulkSelectMode ? (
                              <button 
                                className="action-btn select"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  toggleCognitionSelection(cognition.id);
                                }}
                                title={selectedCognitions.has(cognition.id) ? "Deselect" : "Select"}
                              >
                                {selectedCognitions.has(cognition.id) ? <FaCheckSquare /> : <FaSquare />}
                              </button>
                            ) : (
                              <>
                                <button className="action-btn duplicate" onClick={(e) => handleDuplicateCognition(cognition.id, e)} title="Duplicate">
                                  <FaCopy />
                                </button>
                                <button className="action-btn share" onClick={(e) => handleShareToCollective(cognition.id, e)} title={cognition.is_public ? "Remove from collective" : "Share to collective"}>
                                  {cognition.is_public ? <FaGlobe /> : <FaShareAlt />}
                                </button>
                                <button className="action-btn star" onClick={(e) => handleStarCognition(cognition.id, e)} title="Star">
                                  <FaRegStar />
                                </button>
                                <button className="action-btn delete" onClick={(e) => handleDeleteCognition(cognition.id, e)} title="Delete">
                                  <FaTrashAlt />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="mobile-footer">
        <button className="collective-btn" onClick={handleCollectiveClick}>Collective</button>
        <button className="new-btn" onClick={handleNewCognitionClick}>New</button>
      </footer>

      {showNewCognitionModal && (
        <div className="modal-overlay" onClick={() => setShowNewCognitionModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Cognition</h3>
              <button className="close-btn" onClick={() => setShowNewCognitionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <textarea
                className="cognition-textarea"
                value={newCognitionText}
                onChange={(e) => setNewCognitionText(e.target.value)}
                placeholder="Paste or type your text here..."
              />
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowNewCognitionModal(false)}>Cancel</button>
              <button
                className="create-btn"
                onClick={handleCreateCognition}
                disabled={creatingCognition || !newCognitionText.trim()}
              >
                {creatingCognition ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InputMode;