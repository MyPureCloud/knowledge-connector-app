import type { JestConfigWithTsJest } from 'ts-jest';
import { createDefaultPreset } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest',
  clearMocks: true,
  resolver: 'ts-jest-resolver',
  testEnvironment: 'node',
  transform: {
    ...createDefaultPreset().transform,
  },
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  modulePathIgnorePatterns: ['/dist'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['cobertura'],
};

export default jestConfig;
