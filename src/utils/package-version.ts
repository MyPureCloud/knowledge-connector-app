import { readFileSync } from 'node:fs';

export function getPackageVersion(): string {
  return (
    process.env.npm_package_version ||
    JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url)).toString(),
    ).version ||
    'unknown'
  );
}
