import type { DemoUser } from '../types/auth';

// Cuentas ficticias de demostración, visibles a propósito en el acceso y en el README.
// No son secretos y nunca deben ser aceptadas por una autenticación de producción.
export const DEMO_PASSWORD = 'tutoria2026';

export const demoAccounts: readonly DemoUser[] = [
  {
    id: 'EST-2023010456',
    role: 'estudiante',
    name: 'Ana Lucía Quispe Rojas',
    identifier: '2023010456',
    email: '2023010456@unas.edu.pe',
  },
  {
    id: 'DOC-0421',
    role: 'tutor',
    name: 'Luis Alberto Vela Ríos',
    identifier: 'DOC-0421',
    email: 'lvela@unas.edu.pe',
  },
  {
    id: 'COM-01',
    role: 'coordinacion',
    name: 'Marta Elena Paredes Auqui',
    identifier: 'coordinacion.tutoria',
    email: 'mparedes@unas.edu.pe',
  },
];
