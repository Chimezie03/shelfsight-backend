import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/**', 'vitest.config.ts'],
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/app.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
    },
  },
  {
    files: ['src/lib/logger.ts', 'src/lib/http-access-log.ts', 'src/middleware/error-handler.ts', 'src/index.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
