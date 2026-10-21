import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleSelector } from './RoleSelector';

describe('accessible role selector', () => {
  it('shows complete labels and announces the active role', () => {
    const onChange = vi.fn();
    render(<RoleSelector value="estudiante" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Estudiante' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Coordinación' })).toHaveTextContent('Coordinación');
    fireEvent.click(screen.getByRole('tab', { name: 'Coordinación' }));
    expect(onChange).toHaveBeenCalledWith('coordinacion');
  });
  it('supports arrow navigation, wrapping and unrelated keys', () => {
    const onChange = vi.fn();
    render(<RoleSelector value="estudiante" onChange={onChange} />);
    const student = screen.getByRole('tab', { name: 'Estudiante' });
    fireEvent.keyDown(student, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('coordinacion');
    expect(screen.getByRole('tab', { name: 'Coordinación' })).toHaveFocus();
    fireEvent.keyDown(student, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('tutor');
    expect(screen.getByRole('tab', { name: 'Tutor' })).toHaveFocus();
    fireEvent.keyDown(student, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
  it('keeps role identifiers and decorative icons outside the accessible label', () => {
    render(<RoleSelector value="tutor" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist', { name: 'Selecciona tu rol' })).toBeInTheDocument();
    const tutor = screen.getByRole('tab', { name: 'Tutor' });
    expect(tutor).toHaveAttribute('data-role', 'tutor');
    expect(tutor.querySelector('.role-icon')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('tab', { name: 'Coordinación' })).toHaveAttribute(
      'data-role',
      'coordinador',
    );
  });
});
