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

  const handleLiftUp = (path) => {
    if (isMouseDown) {
      navigate(path);
      setIsMouseDown(false);
      setActiveMenu(null);
    }
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
              <div onMouseUp={() => handleLiftUp('/dump')} className="pre-nav-option" role="button" tabIndex={0}>Dump</div>
              <div onMouseUp={() => handleLiftUp('/compose')} className="pre-nav-option" role="button" tabIndex={0}>Compose</div>
              <div onMouseUp={() => handleLiftUp('/stream')} className="pre-nav-option" role="button" tabIndex={0}>Stream</div>
            </>
          )}
          {activeMenu === 'search' && (
            <>
              <div onMouseUp={() => handleLiftUp('/search')} className="pre-nav-option" role="button" tabIndex={0}>Find</div>
              <div onMouseUp={() => handleLiftUp('/collective')} className="pre-nav-option" role="button" tabIndex={0}>Collective</div>
              <div onMouseUp={() => handleLiftUp('/people')} className="pre-nav-option" role="button" tabIndex={0}>People</div>
            </>
          )}
          {activeMenu === 'user' && (
            <>
              <div onMouseUp={() => handleLiftUp('/profile')} className="pre-nav-option" role="button" tabIndex={0}>Profile</div>
              <div onMouseUp={() => handleLiftUp('/settings')} className="pre-nav-option" role="button" tabIndex={0}>Settings</div>
              <div onMouseUp={() => handleLiftUp('/logout')} className="pre-nav-option" role="button" tabIndex={0}>Logout</div>
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