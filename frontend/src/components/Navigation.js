import './Navigation.css';
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPlus, FaSearch } from 'react-icons/fa';


function Navigation() {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeMenu, setActiveMenu] = useState(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  React.useEffect(() => {
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      {activeMenu && (
        <div
          className="pre-nav-block"
          onMouseLeave={() => setActiveMenu(null)}
        >
          {activeMenu === 'plus' && (
            <>
              <div className="pre-nav-option">Dump</div>
              <div className="pre-nav-option">Compose</div>
              <div className="pre-nav-option">Stream</div>
            </>
          )}
          {activeMenu === 'search' && (
            <>
              <div className="pre-nav-option">Find</div>
              <div className="pre-nav-option">Collective</div>
              <div className="pre-nav-option">People</div>
            </>
          )}
          {activeMenu === 'user' && (
            <>
              <div className="pre-nav-option">Profile</div>
              <div className="pre-nav-option">Settings</div>
              <div
                className="pre-nav-option"
                onMouseUp={handleLogout}
                tabIndex={0}
                role="button"
                style={{ cursor: 'pointer' }}
              >
                Logout
              </div>
            </>
          )}
        </div>
      )}
      <nav className={`simple-mobile-dock${activeMenu ? ' dock-active' : ''}`}>
        <button
          onMouseDown={() => {
            setActiveMenu('search');
            setIsMouseDown(true);
          }}
          onMouseEnter={() => {
            if (isMouseDown) setActiveMenu('search');
          }}
          onMouseUp={() => setIsMouseDown(false)}
        >
          <FaSearch />
        </button>
        <button
          onMouseDown={() => {
            setActiveMenu('plus');
            setIsMouseDown(true);
          }}
          onMouseEnter={() => {
            if (isMouseDown) setActiveMenu('plus');
          }}
          onMouseUp={() => setIsMouseDown(false)}
        >
          <FaPlus />
        </button>
        <button
          onMouseDown={() => {
            setActiveMenu('user');
            setIsMouseDown(true);
          }}
          onMouseEnter={() => {
            if (isMouseDown) setActiveMenu('user');
          }}
          onMouseUp={() => setIsMouseDown(false)}
        >
          <FaUser />
        </button>
      </nav>
    </div>
  );
}

export default Navigation;