import nextJest from 'next/jest.js'
import type { Config } from 'jest'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coveragePathIgnorePatterns: [
    'src/app/api/ably/*',
    'src/app/.*/page.tsx',
    'src/app/layout.tsx',
    'src/providers/ably/*',
    'src/lib/ably.ts',
    'index.ts',
    'logger.ts',
    'mocks/',
    'types.ts',
    'types/',
    'utils/test-utils-node.ts',
    'utils/test-utils.ts',
    'utils/mock-fetch.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'json-summary', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePaths: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@lambersond/3d-dice-core$':
      '<rootDir>/packages/3d-dice-core/src/index.ts',
    '^@lambersond/3d-dice-react$':
      '<rootDir>/packages/3d-dice-react/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
