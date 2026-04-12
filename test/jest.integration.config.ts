import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  rootDir: '..',
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  testTimeout: 60_000,
};

export default config;
