import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenesysDestinationAdapter } from '../../genesys';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { HtmlTransformer } from './html-transformer';
import {
  generateNormalizedCategory,
  generateNormalizedDocument,
  generateNormalizedLabel,
} from '../../tests/utils/entity-generators';
import { cloneDeep } from 'lodash';
import { DocumentBodyBlock } from 'knowledge-html-converter';
import { PipeContext } from '../../pipe/pipe-context.js';

jest.mock('../../genesys/genesys-destination-adapter.js');
jest.mock('knowledge-html-converter', () => {
  return {
    convertHtmlToBlocks: (_html: string): DocumentBodyBlock[] => [
      {
        type: 'Paragraph',
        paragraph: {
          blocks: [],
        },
      },
    ],
  };
});

describe('HtmlTransformer', () => {
  let sourceAdapter: SourceAdapter<unknown, unknown, unknown>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<
    SourceAdapter<unknown, unknown, unknown>,
    GenesysDestinationAdapter
  >;
  let htmlTransformer: HtmlTransformer;

  beforeEach(async () => {
    sourceAdapter = {
      initialize: jest.fn<() => Promise<void>>(),
    } as unknown as SourceAdapter<unknown, unknown, unknown>;
    destinationAdapter = new GenesysDestinationAdapter();
    adapters = {
      sourceAdapter,
      destinationAdapter,
    };

    htmlTransformer = new HtmlTransformer();

    await htmlTransformer.initialize({}, adapters, {} as PipeContext);
  });

  describe('runOnCategory', () => {
    it('should return untouched', async () => {
      const category = generateNormalizedCategory('1');

      const result = await htmlTransformer.runOnCategory(cloneDeep(category));

      expect(result).toEqual(category);
    });
  });

  describe('runOnLabel', () => {
    it('should return untouched', async () => {
      const label = generateNormalizedLabel('1');

      const result = await htmlTransformer.runOnLabel(cloneDeep(label));

      expect(result).toEqual(label);
    });
  });

  describe('runOnDocument', () => {
    it('should return document with transformed body', async () => {
      const document = generateNormalizedDocument('1');

      const result = await htmlTransformer.runOnDocument(document);

      expect(result.published?.variations[0].rawHtml).toBeUndefined();
      expect(result.published?.variations[0].body).toEqual({
        blocks: [
          {
            type: 'Paragraph',
            paragraph: {
              blocks: [],
            },
          },
        ],
      });
    });
  });
});
