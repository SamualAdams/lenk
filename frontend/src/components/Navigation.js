import './Navigation.css';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';


function Navigation() {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav>
      <div className="container">
        <Link to="/" className="logo">Cognition Reader</Link>
        <div className="nav-links">
          <Link 
            to="/collective" 
            className={`nav-link${location.pathname === '/collective' ? ' active' : ''}`}
          >
            Collective
          </Link>
          <Link 
            to="/groups" 
            className={`nav-link${location.pathname.startsWith('/groups') ? ' active' : ''}`}
          >
            Groups
          </Link>
          {currentUser ? (
            <>
              <Link 
                to="/profile" 
                className={`nav-link username-link${location.pathname.startsWith('/profile') ? ' active' : ''}`}
              >
                {currentUser.username}
              </Link>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className={`nav-link${location.pathname === '/login' ? ' active' : ''}`}>Login</Link>
              <Link to="/register" className={`nav-link${location.pathname === '/register' ? ' active' : ''}`}>Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navigation;