import React, { useState, useEffect } from 'react';
import { FaUser, FaCrown, FaStar, FaUserMinus, FaUserPlus } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';

function GroupMembers({ groupId, isAdmin, currentUserId, onMemberUpdate }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/groups/${groupId}/members/`);
      setMembers(response.data);
    } catch (err) {
      setError('Failed to load group members');
      console.error('Group members fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Change this member's role to ${newRole}?`)) return;

    setActionLoading(userId);
    try {
      await axiosInstance.patch(`/groups/${groupId}/update_member_role/`, {
        user_id: userId,
        role: newRole
      });
      fetchMembers();
      onMemberUpdate?.();
    } catch (err) {
      console.error('Role change error:', err);
      setError(err.response?.data?.error || 'Failed to update member role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (userId, username) => {
    if (!window.confirm(`Remove ${username} from the group?`)) return;

    setActionLoading(userId);
    try {
      await axiosInstance.post(`/groups/${groupId}/remove_member/`, {
        user_id: userId
      });
      fetchMembers();
      onMemberUpdate?.();
    } catch (err) {
      console.error('Remove member error:', err);
      setError(err.response?.data?.error || 'Failed to remove member');
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

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <FaStar className="role-icon admin" />;
      default:
        return <FaUser className="role-icon member" />;
    }
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? 'admin' : 'member';
  };

  if (loading) {
    return (
      <div className="group-members loading">
        <div className="loading-message">Loading members...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-members error">
        <div className="error-message">{error}</div>
        <button onClick={fetchMembers} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="group-members">
      <div className="members-list">
        {members.map(member => (
          <div key={member.id} className="member-card">
            <div className="member-info">
              <div className="member-avatar">
                <FaUser size={24} />
              </div>
              
              <div className="member-details">
                <div className="member-header">
                  <h4 className="member-name">{member.username}</h4>
                  <div className={`member-role ${getRoleColor(member.role)}`}>
                    {getRoleIcon(member.role)}
                    <span className="role-text">{member.role}</span>
                  </div>
                </div>
                
                <div className="member-meta">
                  <span>Joined {formatDate(member.joined_at)}</span>
                </div>
              </div>
            </div>

            {isAdmin && member.user_id !== currentUserId && (
              <div className="member-actions">
                {member.role === 'member' ? (
                  <button
                    onClick={() => handleRoleChange(member.user_id, 'admin')}
                    disabled={actionLoading === member.user_id}
                    className="role-btn promote"
                    title="Promote to Admin"
                  >
                    <FaUserPlus />
                    {actionLoading === member.user_id ? '...' : 'Make Admin'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRoleChange(member.user_id, 'member')}
                    disabled={actionLoading === member.user_id}
                    className="role-btn demote"
                    title="Demote to Member"
                  >
                    <FaUserMinus />
                    {actionLoading === member.user_id ? '...' : 'Remove Admin'}
                  </button>
                )}
                
                <button
                  onClick={() => handleRemoveMember(member.user_id, member.username)}
                  disabled={actionLoading === member.user_id}
                  className="remove-btn"
                  title="Remove from Group"
                >
                  <FaUserMinus />
                  {actionLoading === member.user_id ? '...' : 'Remove'}
                </button>
              </div>
            )}

            {member.user_id === currentUserId && (
              <div className="member-badge">
                <span>You</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default GroupMembers;