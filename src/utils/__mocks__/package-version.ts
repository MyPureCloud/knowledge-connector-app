import { jest } from '@jest/globals';

export const getPackageVersion = jest.fn<() => string>(() => '0.0.0');
