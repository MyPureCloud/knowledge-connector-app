import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GenesysDestinationAdapter } from '../../genesys';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { HtmlTransformer } from './html-transformer.js';
import {
  generateNormalizedCategory,
  generateNormalizedLabel,
  generateRawDocument,
} from '../../tests/utils/entity-generators.js';
import { cloneDeep } from 'lodash';
import { PipeContext } from '../../pipe/pipe-context.js';
import { convertHtmlToBlocks } from 'knowledge-html-converter';
import { EntityType } from '../../model/entity-type.js';
import { ErrorCodes } from '../../utils/errors/error-codes.js';
import { HtmlConverterError } from '../../utils/errors/html-converter-error.js';

jest.mock('../../utils/package-version.js');
jest.mock('../../genesys/genesys-destination-adapter.js');
jest.mock('knowledge-html-converter', () => ({
  convertHtmlToBlocks: jest.fn()
}))

describe('HtmlTransformer', () => {
  let sourceAdapter: SourceAdapter<unknown, unknown, unknown>;
  let destinationAdapter: GenesysDestinationAdapter;
  let adapters: AdapterPair<
    SourceAdapter<unknown, unknown, unknown>,
    GenesysDestinationAdapter
  >;
  let htmlTransformer: HtmlTransformer;

  beforeEach(async () => {
    (convertHtmlToBlocks as jest.Mock).mockImplementation(() => [
      {
        type: 'Paragraph',
        paragraph: {
          blocks: [],
        },
      },
    ]);

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

  it('should throw HtmlConverterError when convertHtmlToBlocks throws an error', async() => {
    const errorMessage = 'An error occurred';
    const expectedError = {
      code: ErrorCodes.HTML_CONVERTER_ERROR,
      entityName: EntityType.DOCUMENT,
      messageWithParams: errorMessage,
      messageParams: undefined,
    };

    (convertHtmlToBlocks as jest.Mock).mockImplementationOnce(() => {
      throw new HtmlConverterError(
        ErrorCodes.HTML_CONVERTER_ERROR,
        errorMessage,
        EntityType.DOCUMENT
      );
    });

    const article = generateRawDocument(
      '<p><img src="https://document-image.url"></p>',
      null,
      null,
      'article-external-id-1',
    );

    try {
      await htmlTransformer.runOnDocument(article);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as HtmlConverterError).toFailedEntityErrors()[0]).toEqual(expectedError);
    }
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
      const article = generateRawDocument(
        '<p><img src="https://document-image.url"></p>',
        null,
        null,
        'article-external-id-1',
      );

      const result = await htmlTransformer.runOnDocument(article);

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
