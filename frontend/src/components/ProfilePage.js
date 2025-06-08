import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaUser, FaUsers, FaFileAlt, FaCalendarAlt, FaEdit, FaSave, FaTimes, FaSearch } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';
import ProfileCognitions from './ProfileCognitions';
import FollowList from './FollowList';
import UserSearch from './UserSearch';
import './ProfilePage.css';

function ProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('cognitions');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      if (!username) {
        // If no username in URL, show current user's profile
        const profileResponse = await axiosInstance.get('/profiles/me/');
        setProfile(profileResponse.data);
        setBioInput(profileResponse.data.bio || '');
      } else {
        // Find profile by username
        const searchResponse = await axiosInstance.get(`/profiles/?search=${username}`);
        const profiles = searchResponse.data.results || searchResponse.data;
        const targetProfile = profiles.find(p => p.username === username);
        
        if (!targetProfile) {
          setError('User not found');
          setLoading(false);
          return;
        }

        // Get detailed profile info
        const profileResponse = await axiosInstance.get(`/profiles/${targetProfile.id}/`);
        setProfile(profileResponse.data);
        setBioInput(profileResponse.data.bio || '');
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    
    try {
      if (profile.is_following) {
        await axiosInstance.post(`/profiles/${profile.id}/unfollow/`);
        setProfile(prev => ({
          ...prev,
          is_following: false,
          follower_count: prev.follower_count - 1
        }));
      } else {
        await axiosInstance.post(`/profiles/${profile.id}/follow/`);
        setProfile(prev => ({
          ...prev,
          is_following: true,
          follower_count: prev.follower_count + 1
        }));
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    }
  };

  const handleBioEdit = () => {
    setIsEditingBio(true);
  };

  const handleBioSave = async () => {
    if (!profile) return;
    
    setUpdating(true);
    try {
      await axiosInstance.patch(`/profiles/${profile.id}/update_bio/`, {
        bio: bioInput
      });
      setProfile(prev => ({ ...prev, bio: bioInput }));
      setIsEditingBio(false);
    } catch (err) {
      console.error('Bio update failed:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleBioCancel = () => {
    setBioInput(profile?.bio || '');
    setIsEditingBio(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  if (loading) {
    return (
      <div className="profile-page loading">
        <div className="loading-message">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page error">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Home
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page error">
        <div className="error-message">Profile not found</div>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-info">
          <div className="profile-avatar">
            <FaUser size={48} />
          </div>
          
          <div className="profile-details">
            <h1 className="profile-username">{profile.username}</h1>
            
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-number">{profile.public_cognitions_count}</span>
                <span className="stat-label">Cognitions</span>
              </div>
              <div className="stat">
                <span className="stat-number">{profile.follower_count}</span>
                <span className="stat-label">Followers</span>
              </div>
              <div className="stat">
                <span className="stat-number">{profile.following_count}</span>
                <span className="stat-label">Following</span>
              </div>
            </div>

            <div className="profile-meta">
              <div className="meta-item">
                <FaCalendarAlt className="meta-icon" />
                <span>Joined {formatDate(profile.join_date)}</span>
              </div>
            </div>

            <div className="profile-bio">
              {isEditingBio ? (
                <div className="bio-edit">
                  <textarea
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    placeholder="Tell us about yourself..."
                    maxLength={500}
                    className="bio-textarea"
                  />
                  <div className="bio-actions">
                    <button 
                      onClick={handleBioSave} 
                      disabled={updating}
                      className="bio-save"
                    >
                      <FaSave /> Save
                    </button>
                    <button 
                      onClick={handleBioCancel}
                      className="bio-cancel"
                    >
                      <FaTimes /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bio-display">
                  <p className="bio-text">
                    {profile.bio || 'No bio yet.'}
                  </p>
                  {profile.is_own_profile && (
                    <button onClick={handleBioEdit} className="bio-edit-btn">
                      <FaEdit /> Edit Bio
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="profile-actions">
            {!profile.is_own_profile && currentUser && (
              <button 
                onClick={handleFollow}
                className={`follow-btn ${profile.is_following ? 'following' : 'not-following'}`}
              >
                {profile.is_following ? 'Unfollow' : 'Follow'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-tabs">
          <button 
            className={`tab ${activeTab === 'cognitions' ? 'active' : ''}`}
            onClick={() => setActiveTab('cognitions')}
          >
            <FaFileAlt /> Cognitions
          </button>
          <button 
            className={`tab ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => setActiveTab('following')}
          >
            Following ({profile.following_count})
          </button>
          <button 
            className={`tab ${activeTab === 'followers' ? 'active' : ''}`}
            onClick={() => setActiveTab('followers')}
          >
            Followers ({profile.follower_count})
          </button>
          {profile.is_own_profile && (
            <button 
              className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
              onClick={() => setActiveTab('discover')}
            >
              <FaSearch /> Discover
            </button>
          )}
        </div>

        <div className="profile-tab-content">
          {activeTab === 'cognitions' && (
            <ProfileCognitions profileId={profile.id} />
          )}
          {activeTab === 'following' && (
            <FollowList 
              profileId={profile.id} 
              type="following" 
              currentUserId={currentUser?.user_id}
            />
          )}
          {activeTab === 'followers' && (
            <FollowList 
              profileId={profile.id} 
              type="followers" 
              currentUserId={currentUser?.user_id}
            />
          )}
          {activeTab === 'discover' && profile.is_own_profile && (
            <UserSearch embedded={true} />
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;