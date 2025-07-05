import { useState, useEffect } from 'react';
import { StorageAPI, User } from '../lib/storage';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = StorageAPI.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string, name?: string) => {
    try {
      const user = StorageAPI.signIn(email, password, name);
      setUser(user);
      return user;
    } catch (error) {
      throw error;
    }
  };

  const signInAnonymous = async () => {
    try {
      const user = StorageAPI.signInAnonymous();
      setUser(user);
      return user;
    } catch (error) {
      throw error;
    }
  };

  const signOut = () => {
    StorageAPI.signOut();
    setUser(null);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signInAnonymous,
    signOut,
  };
}