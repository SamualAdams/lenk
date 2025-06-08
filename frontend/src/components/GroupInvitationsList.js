import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaEnvelope, FaCheck, FaTimes, FaUsers, FaCalendarAlt } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import './GroupInvitationsList.css';

function GroupInvitationsList() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/invitations/');
      setInvitations(response.data.results || response.data);
    } catch (err) {
      setError('Failed to load invitations');
      console.error('Invitations fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      await axiosInstance.post(`/invitations/${invitationId}/accept/`);
      fetchInvitations(); // Refresh the list
    } catch (err) {
      console.error('Accept invitation error:', err);
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      await axiosInstance.post(`/invitations/${invitationId}/decline/`);
      fetchInvitations(); // Refresh the list
    } catch (err) {
      console.error('Decline invitation error:', err);
      setError(err.response?.data?.error || 'Failed to decline invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPendingInvitations = () => {
    return invitations.filter(inv => inv.status === 'pending');
  };

  const getRespondedInvitations = () => {
    return invitations.filter(inv => inv.status !== 'pending');
  };

  if (loading) {
    return (
      <div className="invitations-list loading">
        <div className="loading-message">Loading invitations...</div>
      </div>
    );
  }

  return (
    <div className="invitations-list">
      <div className="invitations-header">
        <h1>Group Invitations</h1>
        <Link to="/groups" className="groups-link">
          <FaUsers /> Browse Groups
        </Link>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Pending Invitations */}
      <div className="invitations-section">
        <h2>Pending Invitations ({getPendingInvitations().length})</h2>
        
        {getPendingInvitations().length === 0 ? (
          <div className="empty-state">
            <FaEnvelope className="empty-icon" />
            <p className="empty-message">No pending invitations</p>
            <p className="empty-subtitle">You're all caught up!</p>
          </div>
        ) : (
          <div className="invitations-grid">
            {getPendingInvitations().map(invitation => (
              <div key={invitation.id} className="invitation-card pending">
                <div className="invitation-header">
                  <div className="group-info">
                    <h3 className="group-name">
                      <Link to={`/groups/${invitation.group}`}>
                        {invitation.group_name}
                      </Link>
                    </h3>
                    <p className="inviter">Invited by {invitation.inviter_username}</p>
                  </div>
                  <div className="invitation-date">
                    <FaCalendarAlt className="date-icon" />
                    <span>{formatDate(invitation.created_at)}</span>
                  </div>
                </div>

                {invitation.message && (
                  <div className="invitation-message">
                    <p>"{invitation.message}"</p>
                  </div>
                )}

                <div className="invitation-actions">
                  <button
                    onClick={() => handleAccept(invitation.id)}
                    disabled={actionLoading === invitation.id}
                    className="accept-btn"
                  >
                    <FaCheck />
                    {actionLoading === invitation.id ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDecline(invitation.id)}
                    disabled={actionLoading === invitation.id}
                    className="decline-btn"
                  >
                    <FaTimes />
                    {actionLoading === invitation.id ? 'Declining...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Responded Invitations */}
      {getRespondedInvitations().length > 0 && (
        <div className="invitations-section">
          <h2>Previous Invitations</h2>
          
          <div className="invitations-grid">
            {getRespondedInvitations().map(invitation => (
              <div key={invitation.id} className={`invitation-card ${invitation.status}`}>
                <div className="invitation-header">
                  <div className="group-info">
                    <h3 className="group-name">
                      <Link to={`/groups/${invitation.group}`}>
                        {invitation.group_name}
                      </Link>
                    </h3>
                    <p className="inviter">From {invitation.inviter_username}</p>
                  </div>
                  <div className="status-badge">
                    {invitation.status === 'accepted' ? (
                      <span className="status accepted">
                        <FaCheck /> Accepted
                      </span>
                    ) : (
                      <span className="status declined">
                        <FaTimes /> Declined
                      </span>
                    )}
                  </div>
                </div>

                <div className="invitation-dates">
                  <span>Invited: {formatDate(invitation.created_at)}</span>
                  <span>Responded: {formatDate(invitation.responded_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupInvitationsList;