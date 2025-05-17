

import React, { createContext, useState, useEffect, useContext } from 'react';
import axiosInstance from '../axiosConfig';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      checkAuthStatus();
    } else {
      setIsLoading(false);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axiosInstance.get('/auth/user/');
      setCurrentUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError('');
      const response = await axiosInstance.post('/auth/login/', { username, password });
      const { token, ...userData } = response.data;
      localStorage.setItem('token', token);
      axiosInstance.defaults.headers.common['Authorization'] = `Token ${token}`;
      setCurrentUser(userData);
      return userData;
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed');
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      setError('');
      const response = await axiosInstance.post('/auth/register/', { username, email, password });
      const { token, ...userData } = response.data;
      localStorage.setItem('token', token);
      axiosInstance.defaults.headers.common['Authorization'] = `Token ${token}`;
      setCurrentUser(userData);
      return userData;
    } catch (error) {
      setError(error.response?.data?.error || 'Registration failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      delete axiosInstance.defaults.headers.common['Authorization'];
      setCurrentUser(null);
    }
  };

  const value = {
    currentUser,
    isLoading,
    error,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}