import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaFileAlt, FaClock, FaEye } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';

function ProfileCognitions({ profileId }) {
  const [cognitions, setCognitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCognitions();
  }, [profileId]);

  const fetchCognitions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/profiles/${profileId}/cognitions/`);
      setCognitions(response.data.results || response.data);
    } catch (err) {
      setError('Failed to load cognitions');
      console.error('Cognitions fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="profile-cognitions loading">
        <div className="loading-message">Loading cognitions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-cognitions error">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (cognitions.length === 0) {
    return (
      <div className="profile-cognitions empty">
        <div className="empty-state">
          <FaFileAlt className="empty-icon" />
          <p className="empty-message">No public cognitions yet</p>
          <p className="empty-subtitle">When this user shares cognitions, they'll appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-cognitions">
      <div className="cognitions-grid">
        {cognitions.map(cognition => (
          <Link 
            key={cognition.id} 
            to={`/cognition/${cognition.id}`}
            className="cognition-card"
          >
            <div className="card-header">
              <h3 className="card-title">{cognition.title}</h3>
            </div>
            
            <div className="card-metadata">
              <div className="metadata-item">
                <FaFileAlt className="metadata-icon" />
                <span>{cognition.nodes_count} nodes</span>
              </div>
              <div className="metadata-item">
                <FaEye className="metadata-icon" />
                <span>{formatDate(cognition.updated_at)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ProfileCognitions;