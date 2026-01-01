'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchUser, type UserResponse } from './backend';
import { fetchUserServerSide } from './UserSessionClient';


type User = UserResponse | null;

interface UserContextType {
  user: User;
  loading: boolean;
  refetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}




const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ initUser, children }: { initUser : User,  children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(initUser || null);
  const [loading, setLoading] = useState(true);

  const refetchUser = async () => {
    setLoading(true);
    try {
      const userData = await fetchUserServerSide();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
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
      } else {
        console.error('Logout failed:', result.error);
        // Optionally, show an error to the user
      }
    } catch (error) {
      console.error('Logout network error:', error);
      // Optionally, set user to null anyway or handle error
    }
  };

  useEffect(() => {
    if (!initUser) {
      refetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refetchUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}