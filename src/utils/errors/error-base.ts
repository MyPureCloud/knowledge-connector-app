import { ErrorMessageParams } from './error-message-params.js';
import { ErrorBody } from './error-body.js';
import { EntityType } from '../../model/entity-type.js';

export abstract class ErrorBase extends Error {
  protected code: string;
  protected entityName?: EntityType;
  protected messageParams?: ErrorMessageParams;

  public constructor(
    code: string,
    message: string,
    entityName?: EntityType,
    messageParams?: ErrorMessageParams,
  ) {
    super(message);

    this.code = code;
    this.entityName = entityName;
    this.messageParams = messageParams;
  }

  public toString = (): string => {
    return JSON.stringify({
      code: this.code,
      entityName: this.entityName,
      messageWithParams: this.message,
      messageParams: this.messageParams,
      stack: this.stack,
    });
  };

  public toFailedEntityErrors(): ErrorBody[] {
    return [
      {
        code: this.code,
        entityName: this.entityName,
        messageWithParams: this.message,
        messageParams: this.messageParams,
      },
    ];
  }
}
