import { GeneratedValue } from './generated-value.js';
import { getRandomColor } from './color-randomizer.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGeneratedValue(type: GeneratedValue): any {
  switch (type) {
    case GeneratedValue.COLOR:
      return getRandomColor();
  }
}
