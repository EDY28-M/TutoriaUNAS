import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext } from './authContext';
import { authService } from '../services/serviceRegistry';
import type { LoginCredentials } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(() => authService.restore());
  const queryClient = useQueryClient();
  const login = useCallback(
    async (credentials: LoginCredentials, remember: boolean) => {
      const account = await authService.login(credentials, remember);
      queryClient.clear();
      setUser(account);
      return account;
    },
    [queryClient],
  );
  const logout = useCallback(() => {
    authService.logout();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);
  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  useEffect(() => {
    window.addEventListener('unas:api-session-expired', logout);
    return () => window.removeEventListener('unas:api-session-expired', logout);
  }, [logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
