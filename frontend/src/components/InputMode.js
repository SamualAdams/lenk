import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import './InputMode.css';

function InputMode() {
  const [cognitions, setCognitions] = useState([]);
  const [rawContent, setRawContent] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  // Load saved cognitions on component mount
  useEffect(() => {
    fetchCognitions();
  }, []);

  const fetchCognitions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosInstance.get('/cognitions/');
      setCognitions(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cognitions:', error);
      setError('Failed to load saved cognitions. Please refresh the page.');
      setIsLoading(false);
    }
  };

  const handleCreateCognition = async () => {
    if (!title.trim()) {
      setError('Please enter a title for your cognition');
      return;
    }

    if (!rawContent.trim()) {
      setError('Please enter or upload some content to process');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      // Create the cognition
      console.log('Creating cognition with:', { title, raw_content: rawContent });
      const cognitionResponse = await axiosInstance.post('/cognitions/', {
          title: title,
          raw_content: rawContent
      });
      
      console.log('Cognition created:', cognitionResponse.data);
      setSuccess('Cognition created successfully!');
      
      // Process the text into nodes
      console.log('Processing text for cognition:', cognitionResponse.data.id);
      await axiosInstance.post(`/cognitions/${cognitionResponse.data.id}/process_text/`);
      
      // Navigate to reading mode using React Router
      navigate(`/cognition/${cognitionResponse.data.id}`);
    } catch (error) {
      console.error('Error creating cognition:', error);
      let errorMessage = 'Failed to create cognition. Please try again.';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.status === 413) {
          errorMessage = 'The text is too large. Please try with a smaller document.';
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) { // 2MB limit
      setError('File size exceeds 2MB limit. Please choose a smaller file.');
      event.target.value = null; // Clear the file input
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setRawContent(e.target.result);
      // Set default title from filename
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
      setError(null); // Clear any previous errors
    };
    reader.onerror = () => {
      setError('Error reading file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleDeleteCognition = async (id, e) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent event bubbling
    
    if (window.confirm('Are you sure you want to delete this cognition?')) {
      try {
        setError(null);
        await axiosInstance.delete(`/cognitions/${id}/`);
        setSuccess('Cognition deleted successfully!');
        fetchCognitions();
      } catch (error) {
        console.error('Error deleting cognition:', error);
        setError('Failed to delete cognition. Please try again.');
      }
    }
  };

  return (
    <div className="input-mode">
      <div className="container">
        <div className="sidebar">
          <h2>Saved Cognitions</h2>
          {isLoading && !cognitions.length ? (
            <div className="loading">Loading cognitions...</div>
          ) : error && !cognitions.length ? (
            <p className="error-message">{error}</p>
          ) : cognitions.length === 0 ? (
            <p className="empty-message">No saved cognitions found.</p>
          ) : (
            <ul className="cognition-list">
              {cognitions.map(cognition => (
                <li key={cognition.id}>
                  <Link to={`/cognition/${cognition.id}`}>{cognition.title}</Link>
                  <span className="node-count">({cognition.nodes_count || 0} nodes)</span>
                  <button 
                    className="delete-btn" 
                    onClick={(e) => handleDeleteCognition(cognition.id, e)}
                    aria-label={`Delete ${cognition.title}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="main-content">
          <div className="input-header">
            <h2>Create New Cognition</h2>
            <div className="title-input">
              <label htmlFor="title">Title:</label>
              <input 
                type="text" 
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter cognition title"
              />
            </div>
          </div>
          
          <textarea
            className="content-textarea"
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="Paste your text here or upload a file..."
          />
          
          <div className="action-buttons">
            <label className="file-upload-btn">
              Browse File
              <input 
                type="file" 
                accept=".txt,.md,.text,.doc,.docx" 
                onChange={handleFileUpload} 
                hidden 
              />
            </label>
            <button 
              className="start-btn"
              onClick={handleCreateCognition}
              disabled={isLoading || !rawContent.trim() || !title.trim()}
            >
              {isLoading ? 'Processing...' : 'Start Reading'}
            </button>
          </div>
          
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}
          
          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Processing your text... This may take a moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InputMode;