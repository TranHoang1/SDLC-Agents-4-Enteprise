import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/', 'node_modules/', 'resources/', 'mcp-server/', 'dist/', '*.vsix', '**/*.js', '**/__tests__/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // Relaxed: codebase not lint-clean yet — only critical rules as errors
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-console': 'off',
    },
  }
);
