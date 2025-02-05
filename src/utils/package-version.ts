import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';

export function getPackageVersion(): string {
  return (
    process.env.npm_package_version ?? readPackageJson().version ?? 'unknown'
  );
}

function readPackageJson(): Record<string, string> {
  try {
    const path = join(process.cwd(), 'package.json');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    getLogger().warn('Cannot read package.json', error as Error);
    return {};
  }
}
