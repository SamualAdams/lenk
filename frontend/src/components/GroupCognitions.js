import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaFileAlt, FaClock, FaPlus, FaUser, FaUsers } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

function GroupCognitions({ groupId, isAdmin, isMember }) {
  const [cognitions, setCognitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    if (isMember) {
      fetchCognitions();
    } else {
      setLoading(false);
    }
  }, [groupId, isMember]);

  const fetchCognitions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/groups/${groupId}/cognitions/`);
      setCognitions(response.data.results || response.data);
    } catch (err) {
      setError('Failed to load group cognitions');
      console.error('Group cognitions fetch error:', err);
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

  const handleCreateCognition = () => {
    // Navigate to create cognition with group context
    window.location.href = `/?group=${groupId}`;
  };

  if (!isMember) {
    return (
      <div className="group-cognitions not-member">
        <div className="empty-state">
          <FaUsers className="empty-icon" />
          <p className="empty-message">Join the group to view cognitions</p>
          <p className="empty-subtitle">Only group members can access shared cognitions</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="group-cognitions loading">
        <div className="loading-message">Loading cognitions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-cognitions error">
        <div className="error-message">{error}</div>
        <button onClick={fetchCognitions} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="group-cognitions">
      {isAdmin && (
        <div className="cognitions-header">
          <button onClick={handleCreateCognition} className="action-btn">
            <FaPlus /> Create Group Cognition
          </button>
        </div>
      )}

      {cognitions.length === 0 ? (
        <div className="empty-state">
          <FaFileAlt className="empty-icon" />
          <p className="empty-message">No cognitions yet</p>
          <p className="empty-subtitle">
            {isAdmin 
              ? "Create the first cognition for this group"
              : "Group admins can create cognitions that will appear here"
            }
          </p>
        </div>
      ) : (
        <div className="cognitions-grid">
          {cognitions.map(cognition => (
            <Link 
              key={cognition.id} 
              to={`/cognition/${cognition.id}`}
              className="cognition-card"
            >
              <div className="card-header">
                <h3 className="card-title">{cognition.title}</h3>
                <div className="card-ownership">
                  <FaUsers className="group-icon" />
                  <span className="group-label">Group Cognition</span>
                </div>
              </div>
              
              <div className="card-metadata">
                <div className="metadata-item">
                  <FaFileAlt className="metadata-icon" />
                  <span>{cognition.nodes_count} nodes</span>
                </div>
                <div className="metadata-item">
                  <FaUser className="metadata-icon" />
                  <span>By {cognition.username}</span>
                </div>
                <div className="metadata-item">
                  <FaClock className="metadata-icon" />
                  <span>{formatDate(cognition.updated_at)}</span>
                </div>
              </div>

              {cognition.can_edit && (
                <div className="card-permissions">
                  <span className="edit-badge">Can Edit</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupCognitions;