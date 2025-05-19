import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../../axiosConfig';
import './Dump.css';
import { FaStar, FaRegStar, FaTrashAlt, FaCopy } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import Navigation from '../../Navigation';

function Dump() {
  const { currentUser } = useAuth();
  const [cognitions, setCognitions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

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
      // Process the raw content into nodes
      await axiosInstance.post(`/cognitions/${response.data.id}/process_text/`);
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

  const handleNewCognition = async () => {
    try {
      const response = await axiosInstance.post('/cognitions/', { title: 'Untitled Cognition', content: '', is_starred: false });
      setCognitions(prev => [...prev, response.data]);
      navigate(`/cognition/${response.data.id}`);
    } catch {
      alert('Failed to create new cognition.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axiosInstance.post('/cognitions/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCognitions(prev => [...prev, response.data]);
    } catch {
      alert('Failed to upload file.');
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleCollectiveClick = () => {
    navigate('/collective');
  };

  const handleArcsClick = () => {
    alert('Arcs feature coming soon!');
  };

  const starredCognitions = cognitions.filter(c => c.is_starred);
  const unstarredCognitions = cognitions.filter(c => !c.is_starred);

  return (
    <div className="input-mode vertical-layout">
      <main className="mobile-network">
        <div className="cognition-list">
          {isLoading && !cognitions.length ? (
            <div className="loading">Loading cognitions...</div>
          ) : error && !cognitions.length ? (
            <p className="error-message">{error}</p>
          ) : cognitions.length === 0 ? (
            <p className="empty-message">No saved cognitions found.</p>
          ) : (
            <>
              <div className="starred-pane">
                <h2>Starred</h2>
                <ul className="cognition-group">
                  {starredCognitions.map(cognition => (
                    <li key={cognition.id} className="cognition-item">
                      <div className="cognition-row">
                        <Link to={`/cognition/${cognition.id}`} className="cognition-title">{cognition.title}</Link>
                        {((cognition.username && cognition.username === currentUser?.username) || (cognition.user && cognition.user === currentUser?.id)) && (
                          <div className="button-group">
                            <button className="delete-btn" onClick={(e) => handleDeleteCognition(cognition.id, e)} aria-label={`Delete ${cognition.title}`}><FaTrashAlt /></button>
                            <button className="duplicate-btn" onClick={(e) => handleDuplicateCognition(cognition.id, e)} aria-label={`Duplicate ${cognition.title}`}><FaCopy /></button>
                            <button className="template-btn" data-starred={cognition.is_starred} onClick={(e) => handleStarCognition(cognition.id, e)} aria-label={`Toggle star for ${cognition.title}`}>{cognition.is_starred ? <FaStar /> : <FaRegStar />}</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="unstarred-pane">
                <h2>All Cognitions</h2>
                <ul className="cognition-group">
                  {unstarredCognitions.map(cognition => (
                    <li key={cognition.id} className="cognition-item">
                      <div className="cognition-row">
                        <Link to={`/cognition/${cognition.id}`} className="cognition-title">{cognition.title}</Link>
                        {((cognition.username && cognition.username === currentUser?.username) || (cognition.user && cognition.user === currentUser?.id)) && (
                          <div className="button-group">
                            <button className="delete-btn" onClick={(e) => handleDeleteCognition(cognition.id, e)} aria-label={`Delete ${cognition.title}`}><FaTrashAlt /></button>
                            <button className="duplicate-btn" onClick={(e) => handleDuplicateCognition(cognition.id, e)} aria-label={`Duplicate ${cognition.title}`}><FaCopy /></button>
                            <button className="template-btn" data-starred={cognition.is_starred} onClick={(e) => handleStarCognition(cognition.id, e)} aria-label={`Toggle star for ${cognition.title}`}>{cognition.is_starred ? <FaStar /> : <FaRegStar />}</button>
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

export default Dump;