import type { JestConfigWithTsJest } from 'ts-jest';
import { defaults as tsjPreset } from 'ts-jest/presets';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest',
  clearMocks: true,
  resolver: 'ts-jest-resolver',
  testEnvironment: 'node',
  transform: {
    ...tsjPreset.transform,
  },
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  modulePathIgnorePatterns: ['/dist'],
};

export default jestConfig;
