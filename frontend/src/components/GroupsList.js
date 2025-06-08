import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaFileAlt, FaPlus, FaGlobe, FaLock, FaUserPlus, FaCrown } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import GroupCreator from './GroupCreator';
import './GroupsList.css';

function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [filter, setFilter] = useState('all'); // all, member, public

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/groups/');
      setGroups(response.data.results || response.data);
    } catch (err) {
      setError('Failed to load groups');
      console.error('Groups fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await axiosInstance.post(`/groups/${groupId}/join/`);
      fetchGroups(); // Refresh the list
    } catch (err) {
      console.error('Join group error:', err);
      alert(err.response?.data?.error || 'Failed to join group');
    }
  };

  const handleGroupCreated = () => {
    setShowCreator(false);
    fetchGroups();
  };

  const getFilteredGroups = () => {
    switch (filter) {
      case 'member':
        return groups.filter(group => group.is_member);
      case 'public':
        return groups.filter(group => group.is_public && !group.is_member);
      default:
        return groups;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="groups-list loading">
        <div className="loading-message">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="groups-list">
      <div className="groups-header">
        <h1>Groups</h1>
        <button 
          onClick={() => setShowCreator(true)} 
          className="create-btn"
        >
          <FaPlus /> Create Group
        </button>
      </div>

      <div className="groups-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Groups
        </button>
        <button 
          className={`filter-btn ${filter === 'member' ? 'active' : ''}`}
          onClick={() => setFilter('member')}
        >
          My Groups
        </button>
        <button 
          className={`filter-btn ${filter === 'public' ? 'active' : ''}`}
          onClick={() => setFilter('public')}
        >
          Discover
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {showCreator && (
        <GroupCreator 
          onGroupCreated={handleGroupCreated}
          onCancel={() => setShowCreator(false)}
        />
      )}

      <div className="groups-grid">
        {getFilteredGroups().map(group => (
          <div key={group.id} className="group-card">
            <div className="group-card-header">
              <div className="group-icon">
                <FaUsers size={24} />
              </div>
              <div className="group-visibility">
                {group.is_public ? (
                  <FaGlobe className="visibility-icon public" title="Public Group" />
                ) : (
                  <FaLock className="visibility-icon private" title="Private Group" />
                )}
              </div>
            </div>

            <div className="group-card-content">
              <h3 className="group-title">
                <Link to={`/groups/${group.id}`}>{group.name}</Link>
              </h3>
              
              {group.description && (
                <p className="group-description">
                  {group.description.length > 100 
                    ? `${group.description.substring(0, 100)}...`
                    : group.description
                  }
                </p>
              )}

              <div className="group-meta">
                <div className="meta-item">
                  <FaCrown className="meta-icon" />
                  <span>{group.founder_username}</span>
                </div>
                <div className="meta-item">
                  <span>Created {formatDate(group.created_at)}</span>
                </div>
              </div>

              <div className="group-stats">
                <div className="stat">
                  <FaUsers className="stat-icon" />
                  <span>{group.member_count} members</span>
                </div>
                <div className="stat">
                  <FaFileAlt className="stat-icon" />
                  <span>{group.cognition_count} cognitions</span>
                </div>
              </div>
            </div>

            <div className="group-card-actions">
              {group.is_member ? (
                <div className="member-status">
                  <Link to={`/groups/${group.id}`} className="view-btn">
                    View Group
                  </Link>
                  {group.is_admin && (
                    <span className="admin-badge">Admin</span>
                  )}
                </div>
              ) : group.is_public ? (
                <button 
                  onClick={() => handleJoinGroup(group.id)}
                  className="join-btn"
                >
                  <FaUserPlus /> Join
                </button>
              ) : (
                <span className="private-notice">Private Group</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {getFilteredGroups().length === 0 && (
        <div className="empty-state">
          <FaUsers className="empty-icon" />
          <p className="empty-message">
            {filter === 'member' 
              ? "You haven't joined any groups yet"
              : filter === 'public'
              ? "No public groups available to join"
              : "No groups found"
            }
          </p>
          <p className="empty-subtitle">
            {filter === 'member' 
              ? "Join existing groups or create your own"
              : "Create the first group to get started"
            }
          </p>
        </div>
      )}
    </div>
  );
}

export default GroupsList;