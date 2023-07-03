import { GeneratedValue } from '../utils/generated-value.js';
import { getGeneratedValue } from '../utils/value-generators.js';

export function generatedValueResolver<T extends object>(entity: T): T {
  (Object.keys(entity) as (keyof typeof entity)[]).forEach((key) => {
    if (entity[key] === GeneratedValue.COLOR) {
      entity[key] = getGeneratedValue(GeneratedValue.COLOR);
    }
  });
  return entity;
}
