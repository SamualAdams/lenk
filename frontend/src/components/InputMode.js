// InputMode.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InputMode.css';

function InputMode() {
  const [cognitions, setCognitions] = useState([]);
  const [rawContent, setRawContent] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved cognitions on component mount
  useEffect(() => {
    fetchCognitions();
  }, []);

  const fetchCognitions = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/cognitions/');
      setCognitions(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cognitions:', error);
      setIsLoading(false);
    }
  };

  const handleCreateCognition = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your cognition');
      return;
    }

    try {
      setIsLoading(true);
      // Create a new cognition
      const cognitionResponse = await axios.post('/api/cognitions/', {
        title: title,
        raw_content: rawContent
      });
      
      // Process the text into nodes
      await axios.post(`/api/cognitions/${cognitionResponse.data.id}/process_text/`);
      
      // Navigate to reading mode
      window.location.href = `/cognition/${cognitionResponse.data.id}`;
    } catch (error) {
      console.error('Error creating cognition:', error);
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
        await axios.delete(`/api/cognitions/${id}/`);
        fetchCognitions();
      } catch (error) {
        console.error('Error deleting cognition:', error);
      }
    }
  };

  return (
    <div className="input-mode">
      <div className="container">
        <div className="sidebar">
          <h2>Saved Cognitions</h2>
          {isLoading ? (
            <p>Loading cognitions...</p>
          ) : (
            <ul className="cognition-list">
              {cognitions.map(cognition => (
                <li key={cognition.id}>
                  <a href={`/cognition/${cognition.id}`}>{cognition.title}</a>
                  <span className="node-count">({cognition.nodes_count} nodes)</span>
                  <button 
                    className="delete-btn" 
                    onClick={() => handleDeleteCognition(cognition.id)}
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
              disabled={isLoading || !rawContent}
            >
              Start Reading
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InputMode;