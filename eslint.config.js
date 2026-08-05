import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_.*|^React$|^[A-Z]', args: 'all', argsIgnorePattern: '^_.*|^[A-Z]', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_.*', ignoreRestSiblings: true }],
      'no-undef': 'error',
      'no-empty': 'warn',
      'no-case-declarations': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['useMagicToast', 'useAuth', 'useMasterAuth', 'generatePOPdf', 'wrap', 'HrFmsPageWrapper', 'AuthProvider', 'MasterAuthBridge'] },
      ],
    },
  },
]
