import { DEMO_PASSWORD, demoAccounts } from '../mocks/accounts';
import type { AuthService, DemoUser, LoginCredentials } from '../types/auth';

const SESSION_KEY = 'tutoria-unas:demo-account';

export class DemoAuthService implements AuthService {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  ) {}

  async login(credentials: LoginCredentials, remember: boolean): Promise<DemoUser> {
    const account = demoAccounts.find(
      (candidate) =>
        candidate.identifier === credentials.identifier.trim() &&
        candidate.role === credentials.role,
    );
    if (!account || credentials.password !== DEMO_PASSWORD) {
      throw new Error('La cuenta de prueba o la contraseña no corresponde al rol seleccionado.');
    }
    this.logout();
    if (remember) {
      try {
        this.storage?.setItem(SESSION_KEY, account.id);
      } catch {
        /* Memory-only access remains available if browser storage is blocked. */
      }
    }
    return { ...account };
  }

  restore(): DemoUser | null {
    try {
      const accountId = this.storage?.getItem(SESSION_KEY);
      const account = demoAccounts.find((candidate) => candidate.id === accountId);
      return account ? { ...account } : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    try {
      this.storage?.removeItem(SESSION_KEY);
    } catch {
      /* The context still clears the in-memory session. */
    }
  }
}

function browserSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export const demoAuthService = new DemoAuthService(browserSessionStorage());
