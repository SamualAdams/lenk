import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import InputMode from './components/InputMode';
import ReadingMode from './components/ReadingMode';
import Navigation from './components/Navigation';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import CollectiveView from './components/CollectiveView';
import ProfilePage from './components/ProfilePage';
import GroupsList from './components/GroupsList';
import GroupPage from './components/GroupPage';
import GroupInvitationsList from './components/GroupInvitationsList';
import './App.css';

function AppContent() {
  const location = useLocation();
  const isReadingMode = location.pathname.includes('/cognition/');

  return (
    <div className="App">
      {!isReadingMode && <Navigation />}
      <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <InputMode />
              </ProtectedRoute>
            } />
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
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/profile/:username" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/groups" element={
              <ProtectedRoute>
                <GroupsList />
              </ProtectedRoute>
            } />
            <Route path="/groups/:id" element={
              <ProtectedRoute>
                <GroupPage />
              </ProtectedRoute>
            } />
            <Route path="/invitations" element={
              <ProtectedRoute>
                <GroupInvitationsList />
              </ProtectedRoute>
            } />
        </Routes>
      </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;