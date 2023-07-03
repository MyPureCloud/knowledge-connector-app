/**
 * Pair of adapters which is injected into every task
 */
export interface AdapterPair<I, O> {
  sourceAdapter: I;

  destinationAdapter: O;
}
