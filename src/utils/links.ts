import { getLogger } from './logger.js';

export function isRelativeUrl(src: string) {
  try {
    const urlObject = new URL(src);
    return urlObject.protocol === null;
  } catch (error) {
    getLogger().debug(`Error parsing URL ${src} - ${error}`);
    // Invalid URL, treat it as relative if it doesn't start with //
    return !src.startsWith('//');
  }
}

export function convertToAbsolute(
  url: string,
  baseUrl: string,
): string | undefined {
  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    getLogger().debug(`Cannot parse URL ${url} - ${error}`);
    return undefined;
  }
}
