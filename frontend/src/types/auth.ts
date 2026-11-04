export const roles = ['estudiante', 'tutor', 'coordinacion'] as const;
export type Role = (typeof roles)[number];

export interface DemoUser {
  id: string;
  role: Role;
  name: string;
  identifier: string;
  email: string;
  personaId?: string;
}

export interface LoginCredentials {
  role: Role;
  identifier: string;
  password: string;
}

export interface AuthService {
  login(credentials: LoginCredentials, remember: boolean): Promise<DemoUser>;
  restore(): DemoUser | null;
  logout(): void;
}
