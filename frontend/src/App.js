import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ReadingMode from './components/Cognition/Consume/ReadingMode';
import Navigation from './components/Navigation';
import Login from './components/Profile/Login';
import Register from './components/Profile/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import CollectiveView from './components/Search/CollectiveView';
import Compose from './components/Cognition/Compose/Compose';
import Dump from './components/Cognition/Compose/Dump';
import Stream from './components/Cognition/Compose/Stream';
import OutlineMode from './components/Cognition/Outline/OutlineMode';
import Account from './components/Profile/Account';
import Settings from './components/Profile/Settings';
import 'normalize.css';
import './App.css';

function LogoutHandler() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleLogout = async () => {
      await logout();
      navigate('/login');
    };
    handleLogout();
  }, [logout, navigate]);

  return <div>Logging out...</div>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navigation />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Root route - redirect to compose */}
            <Route path="/" element={
              <ProtectedRoute>
                <Navigate to="/compose" />
              </ProtectedRoute>
            } />
            <Route path="/compose" element={
              <ProtectedRoute>
                <Compose />
              </ProtectedRoute>
            } />
            <Route path="/dump" element={
              <ProtectedRoute>
                <Dump />
              </ProtectedRoute>
            } />
            <Route path="/stream" element={
              <ProtectedRoute>
                <Stream />
              </ProtectedRoute>
            } />
            <Route path="/outline/:id" element={
              <ProtectedRoute>
                <OutlineMode />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/logout" element={<LogoutHandler />} />

            {/* Protected routes */}
            <Route path="/cognition/:id" element={
              <ProtectedRoute>
                <ReadingMode />
              </ProtectedRoute>
            } />
            <Route path="/collective" element={
              <ProtectedRoute>
                <CollectiveView />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;