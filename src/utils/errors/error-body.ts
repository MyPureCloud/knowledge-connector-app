import { ErrorMessageParams } from './error-message-params';
import { EntityType } from '../../model/entity-type';

export interface ErrorBody {
  code: string;
  entityName?: EntityType;
  messageWithParams: string;
  messageParams?: ErrorMessageParams;
}
