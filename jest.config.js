/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './',
  coverageDirectory: '<rootDir>/coverage',
  coveragePathIgnorePatterns: ['../../node_modules/'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
  coverageReporters: ['json', 'html'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  errorOnDeprecated: true,
  slowTestThreshold: 5,
  testTimeout: 30000,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
