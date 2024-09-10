/**
 * Removes trailing slash from the end of the url if it is present
 * @param url
 */
export function removeTrailingSlash(url: string): string {
  if (url.endsWith('/') && url.length > 1) {
    return url.slice(0, -1);
  }
  return url;
}
