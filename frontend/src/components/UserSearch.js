import React, { useState } from 'react';
import { FaSearch, FaUser } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import UserCard from './UserCard';
import { useAuth } from '../context/AuthContext';
import './UserSearch.css';

function UserSearch({ embedded = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const { currentUser } = useAuth();

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/profiles/search_users/?q=${encodeURIComponent(searchQuery)}`);
      setResults(response.data.results || response.data);
      setHasSearched(true);
    } catch (err) {
      setError('Failed to search users');
      console.error('User search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleFollowChange = (userId, isFollowing) => {
    setResults(prevResults => 
      prevResults.map(user => 
        user.id === userId ? { ...user, is_following: isFollowing } : user
      )
    );
  };

  return (
    <div className={`user-search ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <div className="search-header">
          <h2>Discover Users</h2>
        </div>
      )}
      <div className="search-container">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search users by username or bio..."
          value={query}
          onChange={handleInputChange}
          className="search-input"
        />
      </div>

      <div className="search-results">
        {loading && (
          <div className="search-loading">
            <div className="loading-message">Searching users...</div>
          </div>
        )}

        {error && (
          <div className="search-error">
            <div className="error-message">{error}</div>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="search-empty">
            <div className="empty-state">
              <FaUser className="empty-icon" />
              <p className="empty-message">No users found</p>
              <p className="empty-subtitle">Try a different search term</p>
            </div>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="search-results-grid">
            {results.map(user => (
              <UserCard
                key={user.id}
                user={user}
                currentUserId={currentUser?.user_id}
                onFollowChange={handleFollowChange}
              />
            ))}
          </div>
        )}

        {!hasSearched && !loading && (
          <div className="search-prompt">
            <div className="empty-state">
              <FaSearch className="empty-icon" />
              <p className="empty-message">Find other users</p>
              <p className="empty-subtitle">Search by username or bio to discover new people</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserSearch;