import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me', { timeout: 10000 });
      setUser(data.data.user);
    } catch {
      localStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password, options = {}) => {
    const { data } = await api.post('/auth/login', {
      email,
      password,
      deviceFingerprint: options.deviceFingerprint,
      trustDevice: options.trustDevice,
      deviceName: options.deviceName,
      country: options.country,
    });
    if (data.data.mfaRequired) {
      return { mfaRequired: true, ...data.data };
    }
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const completeMfaLogin = async (userId, code, options = {}) => {
    const { data } = await api.post('/auth/mfa/verify', {
      userId,
      code,
      trustDevice: options.trustDevice,
      deviceName: options.deviceName,
      deviceFingerprint: options.deviceFingerprint,
    });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const magicLinkLogin = async (token) => {
    const { data } = await api.post('/auth/magic-link/verify', { token });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const signup = async (formData) => {
    const { data } = await api.post('/auth/signup', formData);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {
        refreshToken: localStorage.getItem('refreshToken'),
      });
    } catch { /* ignore */ }
    localStorage.clear();
    setUser(null);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeMfaLogin, magicLinkLogin, signup, logout, hasRole, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
