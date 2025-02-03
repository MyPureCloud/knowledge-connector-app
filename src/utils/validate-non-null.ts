import { ValidationError } from './errors/validation-error.js';

/**
 * Throw validation error when the given variable has no value
 * @param value
 * @param message
 * @returns value
 */
export function validateNonNull<T>(
  value: T | undefined | null,
  message: string,
): T {
  if (!value) {
    throw new ValidationError(message, {});
  }
  return value as T;
}
