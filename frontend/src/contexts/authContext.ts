import { createContext } from 'react';
import type { DemoUser, LoginCredentials } from '../types/auth';

export interface AuthContextValue {
  user: DemoUser | null;
  login(credentials: LoginCredentials, remember: boolean): Promise<DemoUser>;
  logout(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
