import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedBusiness = localStorage.getItem('business');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      api.setToken(savedToken);
      if (savedBusiness && savedBusiness !== 'undefined') {
        setBusiness(JSON.parse(savedBusiness));
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken, businessData) => {
    setUser(userData);
    setToken(authToken);
    setBusiness(businessData || null);
    api.setToken(authToken);
    
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    if (businessData) {
      localStorage.setItem('business', JSON.stringify(businessData));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setBusiness(null);
    api.setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('business');
  };

  return (
    <AuthContext.Provider value={{ user, token, business, setBusiness, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
