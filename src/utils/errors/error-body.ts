import { ErrorMessageParams } from './error-message-params.js';
import { EntityType } from '../../model/entity-type.js';

export interface ErrorBody {
  code: string;
  entityName?: EntityType;
  messageWithParams: string;
  messageParams?: ErrorMessageParams;
}
