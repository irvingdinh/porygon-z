import type { Config } from 'jest';

const config: Config = {
  projects: ['<rootDir>/test/jest.unit.config.ts', '<rootDir>/test/jest.integration.config.ts', '<rootDir>/test/jest.e2e.config.ts'],
};

export default config;
