import type { Config } from 'jest';

const config: Config = {
  displayName: 'e2e',
  rootDir: '..',
  testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  globalSetup: '<rootDir>/test/e2e/global-setup.ts',
  globalTeardown: '<rootDir>/test/e2e/global-teardown.ts',
  testTimeout: 120_000,
};

export default config;
