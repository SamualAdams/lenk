import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUser, FaUsers } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';

function UserCard({ user, currentUserId, onFollowChange }) {
  const [isFollowing, setIsFollowing] = useState(user.is_following);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e) => {
    e.preventDefault(); // Prevent navigation when clicking follow button
    e.stopPropagation();
    
    if (loading) return;
    
    setLoading(true);
    try {
      if (isFollowing) {
        await axiosInstance.post(`/profiles/${user.id}/unfollow/`);
        setIsFollowing(false);
        onFollowChange?.(user.id, false);
      } else {
        await axiosInstance.post(`/profiles/${user.id}/follow/`);
        setIsFollowing(true);
        onFollowChange?.(user.id, true);
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOwnProfile = user.user_id === currentUserId;

  return (
    <Link to={`/profile/${user.username}`} className="user-card">
      <div className="user-card-content">
        <div className="user-avatar">
          <FaUser size={32} />
        </div>

        <div className="user-info">
          <h3 className="user-username">{user.username}</h3>
          
          {user.bio && (
            <p className="user-bio">
              {user.bio.length > 80 ? `${user.bio.substring(0, 80)}...` : user.bio}
            </p>
          )}

          <div className="user-stats">
            <span className="user-stat">
              <FaUsers className="stat-icon" />
              {user.follower_count} followers
            </span>
          </div>
        </div>

        {!isOwnProfile && currentUserId && (
          <div className="user-actions">
            <button
              onClick={handleFollow}
              disabled={loading}
              className={`follow-btn ${isFollowing ? 'following' : 'not-following'}`}
            >
              {loading ? '...' : (isFollowing ? 'Following' : 'Follow')}
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}

export default UserCard;