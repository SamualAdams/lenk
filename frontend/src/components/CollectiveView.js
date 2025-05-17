

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchCollective } from '../redux/actions/socialActions';
import './CollectiveView.css';

const CollectiveView = () => {
  const dispatch = useDispatch();
  const { cognitions, loading, error } = useSelector(state => state.social.collective);
  const [followingOnly, setFollowingOnly] = useState(false);
  
  useEffect(() => {
    dispatch(fetchCollective(followingOnly));
  }, [dispatch, followingOnly]);
  
  const toggleFollowingOnly = () => {
    setFollowingOnly(!followingOnly);
  };
  
  if (loading) {
    return <div className="collective-loading">Loading collective feed...</div>;
  }
  
  if (error) {
    return <div className="collective-error">{error}</div>;
  }
  
  return (
    <div className="collective-container">
      <div className="collective-header">
        <h1>Collective</h1>
        <div className="filter-options">
          <button 
            className={`filter-btn ${followingOnly ? 'active' : ''}`}
            onClick={toggleFollowingOnly}
          >
            {followingOnly ? 'Following Only' : 'All Shared'}
          </button>
        </div>
      </div>
      
      {cognitions.length === 0 ? (
        <div className="empty-message">
          {followingOnly 
            ? "No shared cognitions from users you follow yet. Try following more users or viewing all shared cognitions."
            : "No shared cognitions yet. Be the first to share!"}
        </div>
      ) : (
        <div className="collective-grid">
          {cognitions.map(cognition => (
            <div key={cognition.id} className="cognition-card">
              <div className="card-header">
                <h3 className="card-title">{cognition.title}</h3>
                <div className="card-author">by {cognition.username}</div>
              </div>
              <div className="card-body">
                <div className="card-meta">
                  <span className="nodes-count">{cognition.nodes_count} nodes</span>
                  <span className="share-date">
                    Shared: {new Date(cognition.share_date).toLocaleDateString()}
                  </span>
                </div>
                <Link to={`/cognition/${cognition.id}`} className="read-button">
                  Read Cognition
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectiveView;