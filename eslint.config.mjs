import pluginJs from '@eslint/js'
import pluginNext from '@next/eslint-plugin-next'
import stylistic from '@stylistic/eslint-plugin'
import { globalIgnores } from 'eslint/config'
import importX from 'eslint-plugin-import-x'
import nounsanitized from 'eslint-plugin-no-unsanitized'
import prettier from 'eslint-plugin-prettier'
import pluginReact from 'eslint-plugin-react'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  { settings: { react: { version: 'detect' } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  unicorn.configs.recommended,
  nounsanitized.configs.recommended,
  sonarjs.configs.recommended,
  {
    plugins: {
      '@next/next': pluginNext,
      '@stylistic': stylistic,
      import: importX,
      prettier,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      camelcase: 'error',
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'always', named: 'never', asyncArrow: 'always' },
      ],
      '@stylistic/max-len': [
        'error',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': [
        'error',
        { max: 1, maxEOF: 0, maxBOF: 0 },
      ],
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-multi-spaces': 'error',
      'no-alert': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'error',
      'react/display-name': 0,
      'react/no-unknown-property': 'off',
      'react/jsx-props-no-multi-spaces': 'error',
      'react/jsx-max-props-per-line': [1, { maximum: 1, when: 'multiline' }],
      'react/prop-types': 0,
      'react/react-in-jsx-scope': 'off',
      'unicorn/no-lonely-if': 'error',
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      'unicorn/prevent-abbreviations': 'off',
      'import/no-unresolved': 'off',
      'import/no-duplicates': ['error', { considerQueryString: true }],
      'import/newline-after-import': 'error',
      'import/order': [
        'error',
        {
          pathGroups: [
            { pattern: 'react', group: 'external', position: 'before' },
          ],
          pathGroupsExcludedImportTypes: ['react', 'type'],
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'unknown',
            'type',
          ],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            {
              target: './src/types/**/*',
              from: './src/@(components|app|utils|constants|hooks|db|schemas)/**/*',
            },
            {
              target: './src/constants/**/*',
              from: './src/@(components|app|utils|hooks|db|schemas)/**/*',
            },
            {
              target: './src/utils/**/*',
              from: './src/@(components|app|hooks|schemas|db)/**/*',
            },
            {
              target: './src/db/**/*',
              from: './src/@(components|app|hooks|schemas)/**/*',
            },
            {
              target: './src/schemas/**/*',
              from: './src/@(components|app|hooks)/**/*',
            },
            {
              target: './src/hooks/**/*',
              from: './src/@(components|app)/**/*',
            },
            { target: './src/components/**/*', from: './src/@(app)/**/*' },
          ],
        },
      ],
      'import/no-cycle': ['error', { maxDepth: 1 }],
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',
      'prettier/prettier': [
        'error',
        {
          arrowParens: 'avoid',
          bracketSpacing: true,
          endOfLine: 'auto',
          jsxSingleQuote: true,
          printWidth: 80,
          semi: false,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'all',
        },
      ],
    },
  },
  {
    files: ['prisma/**/*.ts'],
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  globalIgnores([
    'coverage/**',
    'packages/3d-dice-engine/**', // vendored third-party — keep upstream style

    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
].filter(Boolean)
