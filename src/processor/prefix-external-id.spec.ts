import { PrefixExternalId } from './prefix-external-id.js';
import { Adapter } from '../adapter/adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Config } from '../config.js';
import { ExternalContent } from '../model/external-content.js';
import {
  generateCategory,
  generateDocument,
  generateLabel,
} from '../tests/utils/entity-generators.js';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('PrefixExternalId', () => {
  const EXTERNAL_ID_PREFIX = 'this-is-the-prefix-';

  let sourceAdapter: Adapter;
  let destinationAdapter: Adapter;
  let adapters: AdapterPair<Adapter, Adapter>;
  let prefixExternalIdProcessor: PrefixExternalId;

  beforeEach(async () => {
    sourceAdapter = new (class implements Adapter {
      async initialize(_config: Config): Promise<void> {}
    })();
    destinationAdapter = new (class implements Adapter {
      async initialize(_config: Config): Promise<void> {}
    })();

    adapters = {
      sourceAdapter,
      destinationAdapter,
    };

    prefixExternalIdProcessor = new PrefixExternalId();

    await prefixExternalIdProcessor.initialize(
      {
        externalIdPrefix: EXTERNAL_ID_PREFIX,
      },
      adapters,
    );
  });

  it('should add prefix to all entities', async () => {
    const content: ExternalContent = {
      labels: [generateLabel('1'), generateLabel('2'), generateLabel('3')],
      categories: [
        generateCategory('1'),
        generateCategory('2'),
        generateCategory('3'),
      ],
      documents: [
        generateDocument('1'),
        generateDocument('2'),
        generateDocument('3'),
      ],
    };

    const result = await prefixExternalIdProcessor.run(content);

    (['labels', 'categories', 'documents'] as (keyof typeof result)[]).forEach(
      (entityType) => {
        expect(result[entityType].length).toBe(3);
        result[entityType].forEach((item, index) =>
          expect(item.externalId).toBe(
            `${EXTERNAL_ID_PREFIX}${entityType}-${index + 1}`,
          ),
        );
      },
    );
  });

  it('should verify that no missing configuration', async () => {
    await prefixExternalIdProcessor.initialize({}, adapters);

    await expect(() =>
      prefixExternalIdProcessor.run({
        labels: [],
        categories: [],
        documents: [],
      }),
    ).rejects.toThrow('Missing EXTERNAL_ID_PREFIX from config');
  });
});
