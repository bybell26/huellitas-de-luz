import { useEffect, useState } from 'react';
import {
  apiLogin,
  apiRegister,
  clearSession,
  getStoredUser,
  type User,
} from '../lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredUser()
      .then(stored => setUser(stored))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    setIsLoading(true);
    try {
      const loggedIn = await apiLogin(email, password);
      setUser(loggedIn);
    } finally {
      setIsLoading(false);
    }
  }

  async function register(email: string, password: string, name: string): Promise<void> {
    setIsLoading(true);
    try {
      const registered = await apiRegister(email, password, name);
      setUser(registered);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout(): Promise<void> {
    await clearSession();
    setUser(null);
  }

  return { user, isLoading, login, register, logout };
}
