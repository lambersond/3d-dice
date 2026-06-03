const transform = {
  '^.+\\.(t|j)sx?$': [
    '@swc/jest',
    {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
    },
  ],
}

const moduleNameMapper = {
  '^@lambersond/3d-dice-core$': '<rootDir>/3d-dice-core/src/index.ts',
  '^@lambersond/3d-dice-react$': '<rootDir>/3d-dice-react/src/index.ts',
}

const shared = { clearMocks: true, transform, moduleNameMapper }

/** @type {import('jest').Config} */
export default {
  coverageProvider: 'v8',
  projects: [
    {
      displayName: '3d-dice-core',
      testEnvironment: 'node',
      roots: ['<rootDir>/3d-dice-core'],
      ...shared,
    },
    {
      displayName: '3d-dice-react',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/3d-dice-react'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      ...shared,
    },
  ],
}
