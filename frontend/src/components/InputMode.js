import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../axiosConfig'; // Import custom axios instance

function InputMode() {
  const [cognitions, setCognitions] = useState([]);
  const [rawContent, setRawContent] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
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
      alert('Please enter a title for your cognition');
      return;
    }

    if (!rawContent.trim()) {
      alert('Please enter or upload some content to process');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Create a new cognition
      console.log('Creating cognition with:', { title, raw_content: rawContent });
      const cognitionResponse = await axiosInstance.post('/cognitions/', {
        title: title,
        raw_content: rawContent
      });
      
      console.log('Cognition created:', cognitionResponse.data);
      
      // Process the text into nodes
      console.log('Processing text for cognition:', cognitionResponse.data.id);
      await axiosInstance.post(`/cognitions/${cognitionResponse.data.id}/process_text/`);
      
      // Navigate to reading mode using React Router
      navigate(`/cognition/${cognitionResponse.data.id}`);
    } catch (error) {
      console.error('Error creating cognition:', error);
      setError('Failed to create cognition. Please try again.');
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setRawContent(e.target.result);
      // Set default title from filename
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    };
    reader.readAsText(file);
  };

  const handleDeleteCognition = async (id) => {
    if (window.confirm('Are you sure you want to delete this cognition?')) {
      try {
        setError(null);
        await axiosInstance.delete(`/cognitions/${id}/`);
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
            <p>Loading cognitions...</p>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : cognitions.length === 0 ? (
            <p>No saved cognitions found.</p>
          ) : (
            <ul className="cognition-list">
              {cognitions.map(cognition => (
                <li key={cognition.id}>
                  <a href={`/cognition/${cognition.id}`}>{cognition.title}</a>
                  <span className="node-count">({cognition.nodes_count || 0} nodes)</span>
                  <button 
                    className="delete-btn" 
                    onClick={() => handleDeleteCognition(cognition.id)}
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
                accept=".txt,.md,.text" 
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
        </div>
      </div>
    </div>
  );
}

export default InputMode;