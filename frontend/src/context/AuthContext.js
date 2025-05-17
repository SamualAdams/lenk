import React, { createContext, useState, useEffect, useContext } from 'react';
import axiosInstance, { registerOrLogin } from '../axiosConfig';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const expiryString = localStorage.getItem('tokenExpiry');
    const expiry = expiryString ? new Date(expiryString) : null;

    if (token && expiry) {
      const now = new Date();
      if (expiry <= now) {
        refreshToken();
      } else {
        checkAuthStatus();
        const interval = setInterval(() => {
          const now = new Date();
          if (expiry - now <= 24 * 60 * 60 * 1000) {
            refreshToken();
          }
        }, 60 * 60 * 1000);
        return () => clearInterval(interval);
      }
      setTokenExpiry(expiry);
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
      localStorage.removeItem('tokenExpiry');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const response = await axiosInstance.post('/auth/refresh-token/');
      const { token } = response.data;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      localStorage.setItem('token', token);
      localStorage.setItem('tokenExpiry', expiry.toISOString());
      axiosInstance.defaults.headers.common['Authorization'] = `Token ${token}`;
      setTokenExpiry(expiry);
      await checkAuthStatus();
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('tokenExpiry');
      setCurrentUser(null);
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError('');
      const response = await registerOrLogin('/auth/login/', { username, password });
      const { token, ...userData } = response.data;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      localStorage.setItem('token', token);
      localStorage.setItem('tokenExpiry', expiry.toISOString());
      axiosInstance.defaults.headers.common['Authorization'] = `Token ${token}`;
      setTokenExpiry(expiry);
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
      const response = await registerOrLogin('/auth/register/', { username, email, password });
      const { token, ...userData } = response.data;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      localStorage.setItem('token', token);
      localStorage.setItem('tokenExpiry', expiry.toISOString());
      axiosInstance.defaults.headers.common['Authorization'] = `Token ${token}`;
      setTokenExpiry(expiry);
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
      localStorage.removeItem('tokenExpiry');
      delete axiosInstance.defaults.headers.common['Authorization'];
      setCurrentUser(null);
      setTokenExpiry(null);
    }
  };

  const value = {
    currentUser,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}