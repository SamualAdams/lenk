import React from 'react';
import { Link } from 'react-router-dom';

function Navigation() {
  return (
    <nav>
      <div className="container">
        <Link to="/" className="logo">Cognition Reader</Link>
        <div className="nav-links">
          {/* You can add additional navigation links here if needed */}
        </div>
      </div>
    </nav>
  );
}

export default Navigation;