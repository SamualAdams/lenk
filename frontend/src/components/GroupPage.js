import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaUsers, FaFileAlt, FaCog, FaPlus, FaUserPlus, FaEnvelope, FaCalendarAlt, FaCrown } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import GroupCognitions from './GroupCognitions';
import GroupMembers from './GroupMembers';
import GroupInvitations from './GroupInvitations';
import GroupSettings from './GroupSettings';
import './GroupPage.css';

function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('cognitions');

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const fetchGroup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/groups/${id}/`);
      setGroup(response.data);
    } catch (err) {
      setError('Failed to load group');
      console.error('Group fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    try {
      await axiosInstance.post(`/groups/${id}/join/`);
      fetchGroup(); // Refresh group data
    } catch (err) {
      console.error('Join group error:', err);
      setError(err.response?.data?.error || 'Failed to join group');
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    
    try {
      await axiosInstance.post(`/groups/${id}/leave/`);
      navigate('/groups'); // Redirect to groups list
    } catch (err) {
      console.error('Leave group error:', err);
      setError(err.response?.data?.error || 'Failed to leave group');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="group-page loading">
        <div className="loading-message">Loading group...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-page error">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/groups')} className="back-button">
          Back to Groups
        </button>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="group-page error">
        <div className="error-message">Group not found</div>
        <button onClick={() => navigate('/groups')} className="back-button">
          Back to Groups
        </button>
      </div>
    );
  }

  return (
    <div className="group-page">
      <div className="group-header">
        <div className="group-info">
          <div className="group-avatar">
            <FaUsers size={48} />
          </div>
          
          <div className="group-details">
            <h1 className="group-name">{group.name}</h1>
            {group.description && (
              <p className="group-description">{group.description}</p>
            )}
            
            <div className="group-stats">
              <div className="stat">
                <span className="stat-number">{group.member_count}</span>
                <span className="stat-label">Members</span>
              </div>
              <div className="stat">
                <span className="stat-number">{group.cognition_count}</span>
                <span className="stat-label">Cognitions</span>
              </div>
            </div>

            <div className="group-meta">
              <div className="meta-item">
                <FaCrown className="meta-icon" />
                <span>Founded by {group.founder_username}</span>
              </div>
              <div className="meta-item">
                <FaCalendarAlt className="meta-icon" />
                <span>Created {formatDate(group.created_at)}</span>
              </div>
              {!group.is_public && (
                <div className="meta-item">
                  <span className="private-badge">Private Group</span>
                </div>
              )}
            </div>
          </div>

          <div className="group-actions">
            {!group.is_member && group.is_public && (
              <button onClick={handleJoinGroup} className="join-btn">
                <FaUserPlus /> Join Group
              </button>
            )}
            {group.is_member && !group.is_admin && (
              <button onClick={handleLeaveGroup} className="leave-btn">
                Leave Group
              </button>
            )}
            {group.is_admin && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`settings-btn ${activeTab === 'settings' ? 'active' : ''}`}
              >
                <FaCog /> Manage
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="group-content">
        <div className="group-tabs">
          <button 
            className={`tab ${activeTab === 'cognitions' ? 'active' : ''}`}
            onClick={() => setActiveTab('cognitions')}
          >
            <FaFileAlt /> Cognitions
          </button>
          <button 
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <FaUsers /> Members ({group.member_count})
          </button>
          {group.is_member && (
            <button 
              className={`tab ${activeTab === 'invitations' ? 'active' : ''}`}
              onClick={() => setActiveTab('invitations')}
            >
              <FaEnvelope /> Invitations
            </button>
          )}
          {group.is_admin && (
            <button 
              className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <FaCog /> Settings
            </button>
          )}
        </div>

        <div className="group-tab-content">
          {activeTab === 'cognitions' && (
            <GroupCognitions 
              groupId={group.id} 
              isAdmin={group.is_admin}
              isMember={group.is_member}
            />
          )}
          {activeTab === 'members' && (
            <GroupMembers 
              groupId={group.id} 
              isAdmin={group.is_admin}
              currentUserId={currentUser?.user_id}
              onMemberUpdate={fetchGroup}
            />
          )}
          {activeTab === 'invitations' && group.is_member && (
            <GroupInvitations 
              groupId={group.id}
              isAdmin={group.is_admin}
            />
          )}
          {activeTab === 'settings' && group.is_admin && (
            <GroupSettings 
              group={group}
              onUpdate={fetchGroup}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupPage;