import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../../axiosConfig';
import './Dump.css';
import { FaStar, FaRegStar, FaTrashAlt, FaCopy, FaPlus, FaPaste, FaSpinner } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import Navigation from '../../Navigation';

function Dump() {
  const { currentUser } = useAuth();
  const [cognitions, setCognitions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  // Quick input state
  const [quickInputText, setQuickInputText] = useState('');
  const [isQuickInputExpanded, setIsQuickInputExpanded] = useState(false);
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  // Modal state
  const [showNewCognitionModal, setShowNewCognitionModal] = useState(false);
  const [newCognitionText, setNewCognitionText] = useState('');
  const [creatingCognition, setCreatingCognition] = useState(false);

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

  // Quick input handlers
  const handleQuickInputFocus = () => {
    setIsQuickInputExpanded(true);
  };

  const handleQuickInputBlur = () => {
    if (!quickInputText.trim()) {
      setIsQuickInputExpanded(false);
    }
  };

  const handleQuickCreate = async () => {
    if (!quickInputText.trim()) return;
    
    setIsCreatingQuick(true);
    try {
      // Create the cognition with initial text
      const response = await axiosInstance.post('/cognitions/', {
        title: generateTitleFromText(quickInputText),
        raw_content: quickInputText,
        is_starred: false,
      });
      
      // Process the raw content into nodes
      await axiosInstance.post(`/cognitions/${response.data.id}/process_text/`);
      
      // Update local state
      setCognitions(prev => [response.data, ...prev]);
      
      // Clear input and collapse
      setQuickInputText('');
      setIsQuickInputExpanded(false);
      
      // Navigate to the new cognition
      navigate(`/cognition/${response.data.id}`);
    } catch (err) {
      console.error('Failed to create cognition:', err);
      alert('Failed to create new cognition.');
    } finally {
      setIsCreatingQuick(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setQuickInputText(text);
        setIsQuickInputExpanded(true);
      }
    } catch (err) {
      console.log('Could not read clipboard:', err);
      // Fallback: just focus the textarea
      setIsQuickInputExpanded(true);
    }
  };

  const generateTitleFromText = (text) => {
    // Generate a title from the first sentence or first 50 characters
    const firstSentence = text.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length <= 50) {
      return firstSentence.trim();
    }
    const truncated = text.trim().substring(0, 47);
    return truncated + (text.length > 47 ? '...' : '');
  };

  // Modal handlers (keeping existing functionality)
  const handleNewCognitionClick = () => {
    setShowNewCognitionModal(true);
  };

  const handleCreateCognition = async () => {
    setCreatingCognition(true);
    try {
      const response = await axiosInstance.post('/cognitions/', {
        title: generateTitleFromText(newCognitionText),
        raw_content: newCognitionText,
        is_starred: false,
      });
      await axiosInstance.post(`/cognitions/${response.data.id}/process_text/`);
      setCognitions(prev => [response.data, ...prev]);
      setShowNewCognitionModal(false);
      setNewCognitionText('');
      navigate(`/cognition/${response.data.id}`);
    } catch (err) {
      alert('Failed to create new cognition.');
    } finally {
      setCreatingCognition(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleQuickCreate();
    }
  };

  const starredCognitions = cognitions.filter(c => c.is_starred);
  const unstarredCognitions = cognitions.filter(c => !c.is_starred);

  return (
    <div className="input-mode vertical-layout">
      {/* Quick Input Section */}
      <div className="quick-input-section">
        <div className={`quick-input-container ${isQuickInputExpanded ? 'expanded' : ''}`}>
          {!isQuickInputExpanded ? (
            <div className="quick-input-collapsed" onClick={handleQuickInputFocus}>
              <FaPlus className="input-icon" />
              <span className="input-placeholder">Add new text to process...</span>
              <button className="paste-btn" onClick={handlePasteFromClipboard} title="Paste from clipboard">
                <FaPaste />
              </button>
            </div>
          ) : (
            <div className="quick-input-expanded">
              <textarea
                className="quick-input-textarea"
                value={quickInputText}
                onChange={(e) => setQuickInputText(e.target.value)}
                onBlur={handleQuickInputBlur}
                onKeyPress={handleKeyPress}
                placeholder="Paste or type your text here. Press Cmd/Ctrl+Enter to create..."
                autoFocus
                rows={6}
              />
              <div className="quick-input-actions">
                <div className="input-hint">
                  <span>Press Cmd/Ctrl+Enter to create</span>
                </div>
                <div className="action-buttons">
                  <button 
                    className="cancel-quick-btn" 
                    onClick={() => {
                      setQuickInputText('');
                      setIsQuickInputExpanded(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="create-quick-btn" 
                    onClick={handleQuickCreate}
                    disabled={!quickInputText.trim() || isCreatingQuick}
                  >
                    {isCreatingQuick ? <FaSpinner className="spinning" /> : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="mobile-network">
        <div className="cognition-list">
          {isLoading && !cognitions.length ? (
            <div className="loading">Loading cognitions...</div>
          ) : error && !cognitions.length ? (
            <p className="error-message">{error}</p>
          ) : cognitions.length === 0 ? (
            <div className="empty-state">
              <p className="empty-message">No saved cognitions yet.</p>
              <p className="empty-hint">Use the text input above to create your first cognition!</p>
            </div>
          ) : (
            <>
              {starredCognitions.length > 0 && (
                <div className="starred-pane">
                  <h2>Starred</h2>
                  <ul className="cognition-group">
                    {starredCognitions.map(cognition => (
                      <li key={cognition.id} className="cognition-item">
                        <div className="cognition-row">
                          <Link to={`/cognition/${cognition.id}`} className="cognition-title">
                            {cognition.title}
                          </Link>
                          {((cognition.username && cognition.username === currentUser?.username) || 
                            (cognition.user && cognition.user === currentUser?.id)) && (
                            <div className="button-group">
                              <button 
                                className="delete-btn" 
                                onClick={(e) => handleDeleteCognition(cognition.id, e)} 
                                aria-label={`Delete ${cognition.title}`}
                              >
                                <FaTrashAlt />
                              </button>
                              <button 
                                className="duplicate-btn" 
                                onClick={(e) => handleDuplicateCognition(cognition.id, e)} 
                                aria-label={`Duplicate ${cognition.title}`}
                              >
                                <FaCopy />
                              </button>
                              <button 
                                className="template-btn" 
                                data-starred={cognition.is_starred} 
                                onClick={(e) => handleStarCognition(cognition.id, e)} 
                                aria-label={`Toggle star for ${cognition.title}`}
                              >
                                {cognition.is_starred ? <FaStar /> : <FaRegStar />}
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="unstarred-pane">
                <h2>{starredCognitions.length > 0 ? 'All Cognitions' : 'Recent Cognitions'}</h2>
                <ul className="cognition-group">
                  {unstarredCognitions.map(cognition => (
                    <li key={cognition.id} className="cognition-item">
                      <div className="cognition-row">
                        <Link to={`/cognition/${cognition.id}`} className="cognition-title">
                          {cognition.title}
                        </Link>
                        {((cognition.username && cognition.username === currentUser?.username) || 
                          (cognition.user && cognition.user === currentUser?.id)) && (
                          <div className="button-group">
                            <button 
                              className="delete-btn" 
                              onClick={(e) => handleDeleteCognition(cognition.id, e)} 
                              aria-label={`Delete ${cognition.title}`}
                            >
                              <FaTrashAlt />
                            </button>
                            <button 
                              className="duplicate-btn" 
                              onClick={(e) => handleDuplicateCognition(cognition.id, e)} 
                              aria-label={`Duplicate ${cognition.title}`}
                            >
                              <FaCopy />
                            </button>
                            <button 
                              className="template-btn" 
                              data-starred={cognition.is_starred} 
                              onClick={(e) => handleStarCognition(cognition.id, e)} 
                              aria-label={`Toggle star for ${cognition.title}`}
                            >
                              {cognition.is_starred ? <FaStar /> : <FaRegStar />}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </main>

      <Navigation />

      {/* Modal (keeping for advanced options) */}
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
              <button className="cancel-btn" onClick={() => setShowNewCognitionModal(false)}>
                Cancel
              </button>
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

export default Dump;