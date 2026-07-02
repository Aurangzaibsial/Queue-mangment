import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((userData, authToken, businessData) => {
    setUser(userData);
    setToken(authToken);
    setBusiness(businessData || null);
    api.setToken(authToken);

    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    if (businessData) {
      localStorage.setItem('business', JSON.stringify(businessData));
    } else {
      localStorage.removeItem('business');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setBusiness(null);
    api.setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('business');
  }, []);

  const login = useCallback(
    (userData, authToken, businessData) => {
      persistSession(userData, authToken, businessData);
    },
    [persistSession]
  );

  const updateUser = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const updateBusiness = useCallback((businessData) => {
    setBusiness(businessData);
    if (businessData) {
      localStorage.setItem('business', JSON.stringify(businessData));
    } else {
      localStorage.removeItem('business');
    }
  }, []);

  // Validate stored token and refresh profile on app load
  useEffect(() => {
    const initSession = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      api.setToken(savedToken);
      try {
        const res = await api.get('/auth/me');
        const { user: freshUser, business: freshBusiness } = res.data;
        persistSession(freshUser, savedToken, freshBusiness);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [persistSession, logout]);

  // Auto-logout when API returns 401 (expired/invalid token)
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        business,
        loading,
        login,
        logout,
        updateUser,
        setBusiness: updateBusiness,
        persistSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
