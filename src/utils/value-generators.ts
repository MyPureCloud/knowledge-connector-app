import { GeneratedValue } from './generated-value.js';
import { getRandomColor } from './color-randomizer.js';

export function getGeneratedValue(type: GeneratedValue): unknown {
  switch (type) {
    case GeneratedValue.COLOR:
      return getRandomColor();
  }
}
