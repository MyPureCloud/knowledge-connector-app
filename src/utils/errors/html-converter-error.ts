import { ErrorBasePublic } from './error-base-public.js';
import { EntityType } from '../../model/entity-type.js';

export class HtmlConverterError extends ErrorBasePublic {
    constructor(code: string, message: string, entityName: EntityType) {
        super(code, message, entityName);
    }
}
