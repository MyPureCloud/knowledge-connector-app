/**
 * Throw error when the given variable has no value
 * @param value
 * @param message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateNonNull(value: any, message: string): void {
  if (!value) {
    throw Error(message);
  }
}
