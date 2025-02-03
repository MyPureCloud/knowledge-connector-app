import { getLogger } from './logger.js';

/**
 * Catch, log and rethrow any error
 * @param fn
 * @param errorMessage
 */
export default async function wrapFunction<T>(
  fn: () => Promise<T>,
  errorMessage: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    getLogger().error(`${errorMessage}: ${error}`, error as Error);
    throw error;
  }
}
