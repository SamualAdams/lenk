import React, { useState } from 'react';
import { FaSave, FaTimes, FaGlobe, FaLock } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import './GroupCreator.css';

function GroupCreator({ onGroupCreated, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.post('/groups/', {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_public: formData.is_public
      });
      
      onGroupCreated(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
      setLoading(false);
    }
  };

  return (
    <div className="group-creator-overlay">
      <div className="group-creator">
        <div className="creator-header">
          <h2>Create New Group</h2>
          <button onClick={onCancel} className="close-btn">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="creator-form">
          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-group">
            <label htmlFor="name">Group Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter group name"
              className="form-input"
              disabled={loading}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose of this group..."
              className="form-textarea"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Group Visibility</label>
            <div className="visibility-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="visibility"
                  checked={formData.is_public}
                  onChange={() => setFormData({ ...formData, is_public: true })}
                  disabled={loading}
                />
                <div className="radio-content">
                  <FaGlobe className="visibility-icon public" />
                  <div>
                    <strong>Public</strong>
                    <p>Anyone can discover and join this group</p>
                  </div>
                </div>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="visibility"
                  checked={!formData.is_public}
                  onChange={() => setFormData({ ...formData, is_public: false })}
                  disabled={loading}
                />
                <div className="radio-content">
                  <FaLock className="visibility-icon private" />
                  <div>
                    <strong>Private</strong>
                    <p>Only invited users can join</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              disabled={loading}
              className="create-btn"
            >
              <FaSave />
              {loading ? 'Creating...' : 'Create Group'}
            </button>
            <button 
              type="button" 
              onClick={onCancel}
              disabled={loading}
              className="cancel-btn"
            >
              <FaTimes /> Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GroupCreator;