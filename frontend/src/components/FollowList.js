import React, { useState, useEffect } from 'react';
import { FaUser, FaSearch } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import UserCard from './UserCard';

function FollowList({ profileId, type, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [profileId, type]);

  useEffect(() => {
    // Filter users based on search query
    if (searchQuery.trim()) {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = type === 'following' ? 'following' : 'followers';
      const response = await axiosInstance.get(`/profiles/${profileId}/${endpoint}/`);
      const userData = response.data.results || response.data;
      setUsers(userData);
      setFilteredUsers(userData);
    } catch (err) {
      setError(`Failed to load ${type}`);
      console.error(`${type} fetch error:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowChange = (userId, isFollowing) => {
    // Update the follow status in the local state
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId ? { ...user, is_following: isFollowing } : user
      )
    );
    setFilteredUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId ? { ...user, is_following: isFollowing } : user
      )
    );
  };

  if (loading) {
    return (
      <div className="follow-list loading">
        <div className="loading-message">Loading {type}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="follow-list error">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="follow-list">
      {users.length > 0 && (
        <div className="follow-list-header">
          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder={`Search ${type}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      )}

      {filteredUsers.length === 0 ? (
        <div className="follow-list empty">
          <div className="empty-state">
            <FaUser className="empty-icon" />
            <p className="empty-message">
              {searchQuery.trim() 
                ? `No ${type} found matching "${searchQuery}"`
                : `No ${type} yet`
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="follow-list-grid">
          {filteredUsers.map(user => (
            <UserCard
              key={user.id}
              user={user}
              currentUserId={currentUserId}
              onFollowChange={handleFollowChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FollowList;