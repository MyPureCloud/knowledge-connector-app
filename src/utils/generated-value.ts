const GENERATED_VALUE_PREFIX = 'generated-value-';

/**
 * Can be used to indicate that this field needs to be filled with value only on entity creation, and it should be excluded during the change detection
 */
export enum GeneratedValue {
  COLOR = GENERATED_VALUE_PREFIX + 'color',
}
