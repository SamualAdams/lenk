import './Navigation.css';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';


function Navigation() {
  const location = useLocation();

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
        </div>
      </div>
    </nav>
  );
}

export default Navigation;