import logger from './logger.js';

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
    logger.error(`${errorMessage}: ${error}`);
    throw error;
  }
}
