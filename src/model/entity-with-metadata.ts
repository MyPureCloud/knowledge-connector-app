import { ErrorBody } from '../utils/errors/error-body.js';

export type EntityWithMetadata<T> = T & {
  errors?: ErrorBody[];
};
