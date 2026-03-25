'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser, apiFetch, type User } from './api';

interface UserContextType {
  user: User | null;
  loading: boolean;
  refetchUser: () => Promise<void>;
  logout: () => Promise<void>;
  toggleDevMode: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ 
  initialUser, 
  children 
}: { 
  initialUser?: User | null;  
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [loading, setLoading] = useState(!initialUser);

  const refetchUser = async () => {
    setLoading(true);
    try {
      const response = await getCurrentUser();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleDevMode = async () => {
    try {
      const response = await apiFetch<User>("/auth/dev-mode", {
        method: "POST",
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to toggle dev mode:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setUser(null);
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    if (!initialUser) {
      refetchUser();
    }
  }, [initialUser]);

  return (
    <UserContext.Provider value={{ user, loading, refetchUser, logout, toggleDevMode }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}