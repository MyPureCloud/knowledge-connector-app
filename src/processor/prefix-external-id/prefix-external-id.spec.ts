import { beforeEach, describe, expect, it } from '@jest/globals';
import { PrefixExternalId } from './prefix-external-id.js';
import { Adapter } from '../../adapter/adapter.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { Config } from '../../config.js';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
} from '../../tests/utils/entity-generators.js';
import { PipeContext } from '../../pipe/pipe-context.js';
import { AdapterContext } from '../../adapter/adapter-context.js';

describe('PrefixExternalId', () => {
  const EXTERNAL_ID_PREFIX = 'this-is-the-prefix-';

  let sourceAdapter: Adapter;
  let destinationAdapter: Adapter;
  let adapters: AdapterPair<Adapter, Adapter>;
  let prefixExternalIdProcessor: PrefixExternalId;

  beforeEach(async () => {
    sourceAdapter = new (class implements Adapter {
      async initialize(
        _config: Config,
        _context: AdapterContext<unknown, unknown, unknown>,
      ): Promise<void> {}
    })();
    destinationAdapter = new (class implements Adapter {
      async initialize(
        _config: Config,
        _context: AdapterContext<unknown, unknown, unknown>,
      ): Promise<void> {}
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
      {} as PipeContext,
    );
  });

  it('should add prefix to label', async () => {
    const result = await prefixExternalIdProcessor.runOnLabel(
      generateNormalizedLabel('-1', undefined, undefined, 'labels-1'),
    );

    expect(result.externalId).toBe(`${EXTERNAL_ID_PREFIX}labels-1`);
  });

  it('should add prefix to category', async () => {
    const result = await prefixExternalIdProcessor.runOnCategory(
      generateNormalizedCategory('-1', undefined, undefined, 'categories-1'),
    );

    expect(result.externalId).toBe(`${EXTERNAL_ID_PREFIX}categories-1`);
  });

  it('should add prefix to document', async () => {
    const result = await prefixExternalIdProcessor.runOnDocument(
      generateNormalizedDocument(
        '-1',
        undefined,
        undefined,
        undefined,
        undefined,
        'documents-1',
      ),
    );

    expect(result.externalId).toBe(`${EXTERNAL_ID_PREFIX}documents-1`);
  });

  it('should ignore missing configuration', async () => {
    await prefixExternalIdProcessor.initialize({}, adapters, {} as PipeContext);

    await prefixExternalIdProcessor.runOnLabel(
      generateNormalizedLabel('-1', undefined, undefined, 'labels-1'),
    );
  });

  it('should add prefix to document only once', async () => {
    const once = await prefixExternalIdProcessor.runOnDocument(
      generateNormalizedDocument(
        '-1',
        undefined,
        undefined,
        undefined,
        undefined,
        'documents-1',
      ),
    );
    const twice = await prefixExternalIdProcessor.runOnDocument(once);

    expect(twice.externalId).toBe(`${EXTERNAL_ID_PREFIX}documents-1`);
  });
});
