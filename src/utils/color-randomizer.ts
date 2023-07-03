/**
 * Randomize a color
 */
export function getRandomColor() {
  return (
    '#' +
    Math.round(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0')
  );
}
