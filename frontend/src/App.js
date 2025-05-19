import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import InputMode from './components/InputMode';
import ReadingMode from './components/Cognition/Consume/ReadingMode';
import Navigation from './components/Navigation';
import Login from './components/Login';
import Register from './components/Profile/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import CollectiveView from './components/Search/CollectiveView';
import 'normalize.css';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          {/* <Navigation /> */}
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            {/*
<Route path="/" element={
  <ProtectedRoute>
    <InputMode />
  </ProtectedRoute>
} />
*/}
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