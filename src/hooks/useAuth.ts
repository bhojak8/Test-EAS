import { useState, useEffect } from 'react';
import { StorageAPI, User } from '../lib/storage';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing user on mount
    const checkCurrentUser = () => {
      try {
        const currentUser = StorageAPI.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading current user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkCurrentUser();
  }, []);

  const signIn = async (email: string, password: string, name?: string): Promise<User> => {
    try {
      setIsLoading(true);
      
      // Validate inputs
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      if (!password || password.length < 1) {
        throw new Error('Please enter a password');
      }

      if (name !== undefined && !name.trim()) {
        throw new Error('Please enter your name');
      }

      const user = StorageAPI.signIn(email.trim(), password, name?.trim());
      setUser(user);
      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInAnonymous = async (): Promise<User> => {
    try {
      setIsLoading(true);
      const user = StorageAPI.signInAnonymous();
      setUser(user);
      return user;
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    try {
      StorageAPI.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
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