import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../contexts/authContext';
import type { DemoUser, Role } from '../types/auth';
import { ProtectedRoute } from './ProtectedRoute';

function renderGuard(user: DemoUser | null, role?: Role) {
  render(
    <AuthContext.Provider value={{ user, login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route element={<ProtectedRoute role={role} />}>
            <Route path="/private" element={<p>Protected content</p>} />
          </Route>
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/no-autorizado" element={<p>Unauthorized page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
const user: DemoUser = {
  id: 'student-1',
  role: 'estudiante',
  name: 'Ana Ejemplo',
  identifier: '2023010456',
  email: 'ana@demo.example',
};

describe('presentation-only demo access guards', () => {
  it('redirects unauthenticated visitors to login', () => {
    renderGuard(null, 'estudiante');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
  it('rejects access to another role', () => {
    renderGuard(user, 'coordinacion');
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument();
  });
  it('renders permitted routes', () => {
    renderGuard(user, 'estudiante');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
  it('allows any authenticated account when no role is specified', () => {
    renderGuard(user);
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
