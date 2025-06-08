import React, { useState } from 'react';
import { FaSave, FaTimes, FaTrash, FaGlobe, FaLock } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';

function GroupSettings({ group, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || '',
    is_public: group.is_public
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axiosInstance.patch(`/groups/${group.id}/`, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_public: formData.is_public
      });
      
      setSuccess('Group settings updated successfully');
      setEditing(false);
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update group settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: group.name,
      description: group.description || '',
      is_public: group.is_public
    });
    setEditing(false);
    setError('');
    setSuccess('');
  };

  const handleDeleteGroup = async () => {
    const confirmText = `DELETE ${group.name}`;
    const userInput = window.prompt(
      `This action cannot be undone. All group cognitions and data will be permanently deleted.\n\nType "${confirmText}" to confirm deletion:`
    );

    if (userInput !== confirmText) {
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.delete(`/groups/${group.id}/`);
      window.location.href = '/groups';
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
      setLoading(false);
    }
  };

  return (
    <div className="group-settings">
      {success && (
        <div className="message success-message">
          {success}
        </div>
      )}

      {error && (
        <div className="message error-message">
          {error}
        </div>
      )}

      <div className="settings-section">
        <h3>Group Information</h3>
        
        {!editing ? (
          <div className="info-display">
            <div className="info-item">
              <label>Name</label>
              <p>{group.name}</p>
            </div>
            
            <div className="info-item">
              <label>Description</label>
              <p>{group.description || 'No description provided'}</p>
            </div>
            
            <div className="info-item">
              <label>Visibility</label>
              <div className="visibility-display">
                {group.is_public ? (
                  <>
                    <FaGlobe className="visibility-icon public" />
                    <span>Public - Anyone can discover and join</span>
                  </>
                ) : (
                  <>
                    <FaLock className="visibility-icon private" />
                    <span>Private - Invitation only</span>
                  </>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => setEditing(true)}
              className="edit-btn"
            >
              Edit Settings
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label htmlFor="name">Group Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                className="form-textarea"
                rows="3"
                disabled={loading}
                placeholder="Describe the purpose of this group..."
              />
            </div>

            <div className="form-group">
              <label>Visibility</label>
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
                className="save-btn"
              >
                <FaSave />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button" 
                onClick={handleCancel}
                disabled={loading}
                className="cancel-btn"
              >
                <FaTimes /> Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="settings-section danger-zone">
        <h3>Danger Zone</h3>
        <div className="danger-content">
          <div className="danger-info">
            <h4>Delete Group</h4>
            <p>Permanently delete this group and all its data. This action cannot be undone.</p>
          </div>
          <button 
            onClick={handleDeleteGroup}
            disabled={loading}
            className="delete-btn"
          >
            <FaTrash /> Delete Group
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupSettings;