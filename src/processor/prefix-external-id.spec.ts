import { PrefixExternalId } from './prefix-external-id.js';
import { Adapter } from '../adapter/adapter.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Config } from '../config.js';
import { ExternalContent } from '../model/external-content.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
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
      labels: [
        generateNormalizedLabel('-1', undefined, undefined, 'labels-1'),
        generateNormalizedLabel('-2', undefined, undefined, 'labels-2'),
        generateNormalizedLabel('-3', undefined, undefined, 'labels-3'),
      ],
      categories: [
        generateNormalizedCategory('-1', undefined, undefined, 'categories-1'),
        generateNormalizedCategory('-2', undefined, undefined, 'categories-2'),
        generateNormalizedCategory('-3', undefined, undefined, 'categories-3'),
      ],
      documents: [
        generateNormalizedDocument(
          '-1',
          undefined,
          undefined,
          undefined,
          undefined,
          'documents-1',
        ),
        generateNormalizedDocument(
          '-2',
          undefined,
          undefined,
          undefined,
          undefined,
          'documents-2',
        ),
        generateNormalizedDocument(
          '-3',
          undefined,
          undefined,
          undefined,
          undefined,
          'documents-3',
        ),
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

  it('should ignore missing configuration', async () => {
    await prefixExternalIdProcessor.initialize({}, adapters);

    await prefixExternalIdProcessor.run({
      labels: [],
      categories: [],
      documents: [],
    });
  });
});
