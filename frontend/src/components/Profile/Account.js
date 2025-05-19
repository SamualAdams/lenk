

import React from 'react';
import { Link } from 'react-router-dom';

function Account() {
  return (
    <div className="account-links" style={{ padding: '1rem', textAlign: 'center' }}>
      <Link to="/login" style={{ margin: '0 1rem' }}>Login</Link>
      <Link to="/register" style={{ margin: '0 1rem' }}>Register</Link>
      <Link to="/logout" style={{ margin: '0 1rem' }}>Logout</Link>
    </div>
  );
}

export default Account;