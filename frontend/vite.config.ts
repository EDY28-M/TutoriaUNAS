import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    watch: {
      // En Windows una escritura puede emitir cambios con el archivo aún vacío.
      // Esperar al cierre evita cachear un módulo sin sus exports durante HMR.
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 25 },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    env: { VITE_DATA_SOURCE: 'demo' },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Se mide la lógica verificable: servicios, utilidades, selectores de
      // datos y los componentes con reglas propias. Las páginas y los volcados
      // de datos ficticios quedan fuera porque son composición y contenido, no
      // lógica; se comprueban con Playwright y axe.
      include: [
        'src/services/demoAuthService.ts',
        'src/utils/csv.ts',
        'src/utils/fechas.ts',
        'src/utils/roles.ts',
        'src/data/academico.ts',
        'src/hooks/usePortal.ts',
        'src/hooks/useFormularioInstrumento.ts',
        'src/utils/validacionInstrumentos.ts',
        'src/components/forms/RoleSelector.tsx',
        'src/routes/ProtectedRoute.tsx',
      ],
      thresholds: { lines: 85, branches: 80, functions: 85, statements: 85 },
    },
  },
});
