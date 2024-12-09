import { ErrorBody } from '../utils/errors/error-body.js';

export type FailedEntity<T> = T & {
  errors: ErrorBody[];
};
