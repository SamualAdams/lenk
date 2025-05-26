import './Navigation.css';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaPlus, FaSearch } from 'react-icons/fa';

function Navigation() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [currentHighlight, setCurrentHighlight] = useState(null);

  // Close menu when mouse moves outside nav area
  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false);
      if (!currentHighlight) {
        setActiveMenu(null);
      }
    };
    
    const handleMouseLeave = () => {
      if (isMouseDown) {
        setActiveMenu(null);
        setIsMouseDown(false);
      }
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    document.querySelector('.pre-nav-block')?.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      document.querySelector('.pre-nav-block')?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isMouseDown, currentHighlight]);

  const handleNavIconClick = (menuType) => {
    // Close current menu if a different icon is clicked
    if (activeMenu && activeMenu !== menuType) {
      setActiveMenu(null);
      setCurrentHighlight(null);
    }
    
    // Toggle menu
    setActiveMenu(activeMenu === menuType ? null : menuType);
  };

  const handleMouseDown = (menuType) => {
    setIsMouseDown(true);
    setActiveMenu(menuType);
  };

  const handleMouseEnter = (menuType) => {
    if (isMouseDown && activeMenu !== menuType) {
      setActiveMenu(menuType);
    }
  };

  const handleOptionEnter = (path) => {
    setCurrentHighlight(path);
  };

  const handleOptionLeave = () => {
    setCurrentHighlight(null);
  };

  const handleLiftUp = (path) => {
    if (path) {
      navigate(path);
    }
    setActiveMenu(null);
    setIsMouseDown(false);
    setCurrentHighlight(null);
  };

  return (
    <div className="navigation-container">
      {activeMenu && (
        <div className="pre-nav-block">
          {activeMenu === 'plus' && (
            <>
              <div 
                className={`pre-nav-option ${currentHighlight === '/dump' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/dump')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/dump')} 
                role="button" 
                tabIndex={0}
              >
                Dump
              </div>
              <div 
                className={`pre-nav-option ${currentHighlight === '/compose' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/compose')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/compose')} 
                role="button" 
                tabIndex={0}
              >
                Compose
              </div>
              <div 
                className={`pre-nav-option ${currentHighlight === '/stream' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/stream')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/stream')} 
                role="button" 
                tabIndex={0}
              >
                Stream
              </div>
            </>
          )}
          {activeMenu === 'search' && (
            <>
              <div 
                className={`pre-nav-option ${currentHighlight === '/search' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/search')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/search')} 
                role="button" 
                tabIndex={0}
              >
                Find
              </div>
              <div 
                className={`pre-nav-option ${currentHighlight === '/collective' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/collective')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/collective')} 
                role="button" 
                tabIndex={0}
              >
                Collective
              </div>
              <div 
                className={`pre-nav-option ${currentHighlight === '/people' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/people')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/people')} 
                role="button" 
                tabIndex={0}
              >
                People
              </div>
            </>
          )}
          {activeMenu === 'user' && (
            <>
              <div 
                className={`pre-nav-option ${currentHighlight === '/profile' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/profile')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/profile')} 
                role="button" 
                tabIndex={0}
              >
                Profile
              </div>
              <div 
                className={`pre-nav-option ${currentHighlight === '/settings' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/settings')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/settings')} 
                role="button" 
                tabIndex={0}
              >
                Settings
              </div>
              <div 
                className={`pre-nav-option ${currentHighlight === '/logout' ? 'highlighted' : ''}`}
                onMouseEnter={() => handleOptionEnter('/logout')} 
                onMouseLeave={handleOptionLeave}
                onMouseUp={() => handleLiftUp('/logout')} 
                role="button" 
                tabIndex={0}
              >
                Logout
              </div>
            </>
          )}
        </div>
      )}
      <nav className={`simple-mobile-dock${activeMenu ? ' dock-active' : ''}`}>
        <button
          className={activeMenu === 'search' ? 'active' : ''}
          onClick={() => handleNavIconClick('search')}
          onMouseDown={() => handleMouseDown('search')}
          onMouseEnter={() => handleMouseEnter('search')}
        >
          <FaSearch />
        </button>
        <button
          className={activeMenu === 'plus' ? 'active' : ''}
          onClick={() => handleNavIconClick('plus')}
          onMouseDown={() => handleMouseDown('plus')}
          onMouseEnter={() => handleMouseEnter('plus')}
        >
          <FaPlus />
        </button>
        <button
          className={activeMenu === 'user' ? 'active' : ''}
          onClick={() => handleNavIconClick('user')}
          onMouseDown={() => handleMouseDown('user')}
          onMouseEnter={() => handleMouseEnter('user')}
        >
          <FaUser />
        </button>
      </nav>
    </div>
  );
}

export default Navigation;