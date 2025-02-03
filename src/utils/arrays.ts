export async function arraysFromAsync<T>(
  generator: AsyncGenerator<T>,
): Promise<T[]> {
  const list: T[] = [];
  for await (const item of generator) {
    list.push(item);
  }
  return list;
}
