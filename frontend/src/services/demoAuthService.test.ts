import { beforeEach, describe, expect, it } from 'vitest';
import { DemoAuthService } from './demoAuthService';
import { DEMO_PASSWORD, demoAccounts } from '../mocks/accounts';

describe('public demonstration authentication', () => {
  let service: DemoAuthService;
  beforeEach(() => {
    sessionStorage.clear();
    service = new DemoAuthService(sessionStorage);
  });
  for (const account of demoAccounts) {
    it(`accepts only the configured ${account.role} account`, async () => {
      const user = await service.login(
        { role: account.role, identifier: ` ${account.identifier} `, password: DEMO_PASSWORD },
        true,
      );
      expect(user).toEqual(account);
      expect(service.restore()).toEqual(account);
      expect(sessionStorage.getItem('tutoria-unas:demo-account')).toBe(account.id);
      expect(JSON.stringify(sessionStorage)).not.toContain(DEMO_PASSWORD);
      user.name = 'Changed';
      expect(service.restore()?.name).toBe(account.name);
      service.logout();
      expect(service.restore()).toBeNull();
    });
  }
  it('rejects invalid credentials and a role/account mismatch', async () => {
    await expect(
      service.login({ role: 'estudiante', identifier: 'unknown', password: DEMO_PASSWORD }, true),
    ).rejects.toThrow();
    await expect(
      service.login({ role: 'tutor', identifier: '2023010456', password: DEMO_PASSWORD }, true),
    ).rejects.toThrow();
    await expect(
      service.login({ role: 'estudiante', identifier: '2023010456', password: 'wrong' }, true),
    ).rejects.toThrow();
    expect(service.restore()).toBeNull();
  });
  it('does not remember unchecked sessions and clears previously remembered accounts', async () => {
    await service.login(
      { role: 'estudiante', identifier: '2023010456', password: DEMO_PASSWORD },
      true,
    );
    await service.login({ role: 'tutor', identifier: 'DOC-0421', password: DEMO_PASSWORD }, false);
    expect(service.restore()).toBeNull();
  });
  it('ignores forged or corrupt stored account identifiers', () => {
    sessionStorage.setItem('tutoria-unas:demo-account', '{"role":"coordinacion"}');
    expect(service.restore()).toBeNull();
  });
  it('works in memory when storage is unavailable or blocked', async () => {
    const blocked = new DemoAuthService({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(blocked.restore()).toBeNull();
    expect(
      (
        await blocked.login(
          { role: 'estudiante', identifier: '2023010456', password: DEMO_PASSWORD },
          true,
        )
      ).role,
    ).toBe('estudiante');
    blocked.logout();
    const memoryOnly = new DemoAuthService(null);
    expect(memoryOnly.restore()).toBeNull();
    expect(
      (
        await memoryOnly.login(
          { role: 'tutor', identifier: 'DOC-0421', password: DEMO_PASSWORD },
          true,
        )
      ).role,
    ).toBe('tutor');
    memoryOnly.logout();
  });
});
