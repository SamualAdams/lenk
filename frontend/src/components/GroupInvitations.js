import React, { useState } from 'react';
import { FaUserPlus, FaPaperPlane, FaTimes } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';

function GroupInvitations({ groupId, isAdmin }) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteData, setInviteData] = useState({
    username: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteData.username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axiosInstance.post(`/groups/${groupId}/invite/`, {
        username: inviteData.username.trim(),
        message: inviteData.message.trim()
      });
      
      setSuccess(`Invitation sent to ${inviteData.username}`);
      setInviteData({ username: '', message: '' });
      setShowInviteForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowInviteForm(false);
    setInviteData({ username: '', message: '' });
    setError('');
    setSuccess('');
  };

  if (!isAdmin) {
    return (
      <div className="group-invitations no-permission">
        <div className="empty-state">
          <FaUserPlus className="empty-icon" />
          <p className="empty-message">Invitations</p>
          <p className="empty-subtitle">Only group admins can send invitations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group-invitations">
      <div className="invitations-header">
        {!showInviteForm ? (
          <button 
            onClick={() => setShowInviteForm(true)} 
            className="action-btn"
          >
            <FaUserPlus /> Invite Member
          </button>
        ) : (
          <div className="invite-form-container">
            <h3>Invite New Member</h3>
            <form onSubmit={handleInvite} className="invite-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={inviteData.username}
                  onChange={(e) => setInviteData({ ...inviteData, username: e.target.value })}
                  placeholder="Enter username to invite"
                  className="form-input"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message (optional)</label>
                <textarea
                  id="message"
                  value={inviteData.message}
                  onChange={(e) => setInviteData({ ...inviteData, message: e.target.value })}
                  placeholder="Add a personal message to the invitation..."
                  className="form-textarea"
                  rows="3"
                  disabled={loading}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="submit-btn"
                >
                  <FaPaperPlane />
                  {loading ? 'Sending...' : 'Send Invitation'}
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
          </div>
        )}
      </div>

      {error && (
        <div className="message error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          {success}
        </div>
      )}

      <div className="invitations-info">
        <div className="info-card">
          <h4>How Invitations Work</h4>
          <ul>
            <li>Enter the username of the person you want to invite</li>
            <li>They'll receive a notification about the invitation</li>
            <li>They can accept or decline the invitation</li>
            <li>Once accepted, they'll become a group member</li>
          </ul>
        </div>

        <div className="info-card">
          <h4>Member Permissions</h4>
          <ul>
            <li><strong>Members:</strong> Can view and contribute to group cognitions</li>
            <li><strong>Admins:</strong> Can manage members, send invitations, and edit group settings</li>
            <li>You can change member roles after they join</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default GroupInvitations;