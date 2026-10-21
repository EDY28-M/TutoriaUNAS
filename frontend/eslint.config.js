import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'test-results', 'playwright-report', 'src/assets/vendor/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          // `PanelFiltros.tsx` publica su propio hook de estado (`useFiltro`) junto al
          // componente que lo consume: es una API de par, no un archivo de utilidades.
          // Moverlo a `src/hooks` implicaría tocar las 11 páginas que lo importan, así
          // que se declara aquí de forma explícita en lugar de silenciar la regla.
          allowExportNames: ['useFiltro'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Convención: un argumento o variable que empieza por `_` es intencionalmente
      // ignorado (por ejemplo, firmas de callback que exigen parámetros posicionales).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // `src/components/ui/icons.tsx` no define componentes: los crea con la fábrica
    // `crearIcono(...)` sobre Font Awesome 6.5.1. La regla de React Refresh no reconoce
    // componentes construidos por llamada y marcaría los ~92 exports como no-componentes.
    // El módulo es estable y no participa del refresco en caliente de la interfaz.
    files: ['src/components/ui/icons.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
