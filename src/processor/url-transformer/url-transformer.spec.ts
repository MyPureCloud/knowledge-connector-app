import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Category, Document, ExternalContent, Label } from '../../model';
import { UrlTransformer } from './url-transformer.js';
import { AdapterPair } from '../../adapter/adapter-pair.js';
import { SourceAdapter } from '../../adapter/source-adapter.js';
import { DestinationAdapter } from '../../adapter/destination-adapter.js';
import _ from 'lodash';
import { GenesysDestinationAdapter } from '../../genesys/genesys-destination-adapter.js';

jest.mock('../../genesys/genesys-destination-adapter.js');

describe('UrlTransformer', () => {
  const HYPERLINKS = [
    'documents.0.published.variations.0.body.blocks.0.paragraph.blocks.0.text.hyperlink',
    'documents.0.published.variations.0.body.blocks.1.list.blocks.0.blocks.0.text.hyperlink',
    'documents.0.published.variations.0.body.blocks.2.paragraph.blocks.0.image.hyperlink',
    'documents.0.published.variations.0.body.blocks.3.table.rows.0.cells.0.blocks.0.list.blocks.0.blocks.0.text.hyperlink',
    'documents.0.published.variations.0.body.blocks.3.table.rows.0.cells.1.blocks.0.image.hyperlink',

    'documents.1.published.variations.0.body.blocks.0.paragraph.blocks.0.text.hyperlink',
    'documents.1.published.variations.0.body.blocks.1.list.blocks.0.blocks.0.text.hyperlink',
    'documents.1.published.variations.0.body.blocks.2.paragraph.blocks.0.image.hyperlink',
    'documents.1.published.variations.0.body.blocks.3.table.rows.0.cells.0.blocks.0.list.blocks.0.blocks.0.text.hyperlink',
    'documents.1.published.variations.0.body.blocks.3.table.rows.0.cells.1.blocks.0.image.hyperlink',

    'documents.2.published.variations.0.body.blocks.0.paragraph.blocks.0.text.hyperlink',
    'documents.2.published.variations.0.body.blocks.1.list.blocks.0.blocks.0.text.hyperlink',
    'documents.2.published.variations.0.body.blocks.2.paragraph.blocks.0.image.hyperlink',
    'documents.2.published.variations.0.body.blocks.3.table.rows.0.cells.0.blocks.0.list.blocks.0.blocks.0.text.hyperlink',
    'documents.2.published.variations.0.body.blocks.3.table.rows.0.cells.1.blocks.0.image.hyperlink',
  ];
  const IMAGE_URLS = [
    'documents.0.published.variations.0.body.blocks.2.paragraph.blocks.0.image.url',
    'documents.0.published.variations.0.body.blocks.3.table.rows.0.cells.1.blocks.0.image.url',

    'documents.1.published.variations.0.body.blocks.2.paragraph.blocks.0.image.url',
    'documents.1.published.variations.0.body.blocks.3.table.rows.0.cells.1.blocks.0.image.url',

    'documents.2.published.variations.0.body.blocks.2.paragraph.blocks.0.image.url',
    'documents.2.published.variations.0.body.blocks.3.table.rows.0.cells.1.blocks.0.image.url',
  ];
  const RELATIVE_URLS = [
    'documents.0.published.variations.0.body.blocks.0.paragraph.blocks.1.text.hyperlink',
    'documents.0.published.variations.0.body.blocks.1.list.blocks.1.blocks.1.image.hyperlink',
  ];

  let transformer: UrlTransformer;
  let content: ExternalContent;
  let adapters: AdapterPair<
    SourceAdapter<Category, Label, Document>,
    DestinationAdapter
  >;
  let destinationAdapter: GenesysDestinationAdapter;
  let sourceAdapter: SourceAdapter<Category, Label, Document>;

  beforeEach(() => {
    transformer = new UrlTransformer();

    content = {
      labels: [],
      categories: [],
      documents: [generateDocument(), generateDocument(), generateDocument()],
    };

    sourceAdapter = createSourceAdapter();
    destinationAdapter = new GenesysDestinationAdapter();
    adapters = {
      sourceAdapter,
      destinationAdapter,
    };
  });

  describe('when fixNonHttpsImages enabled', () => {
    beforeEach(async () => {
      await transformer.initialize(
        {
          fixNonHttpsImages: 'true',
        },
        adapters as AdapterPair<
          SourceAdapter<unknown, unknown, unknown>,
          DestinationAdapter
        >,
      );
    });

    it('should fix image urls', async () => {
      const result = await transformer.run(content);

      verifyUrl(result, IMAGE_URLS, true);
      verifyUrl(result, HYPERLINKS, false);
    });
  });

  describe('when fixNonHttpsLinks enabled', () => {
    beforeEach(async () => {
      await transformer.initialize(
        {
          fixNonHttpsLinks: 'true',
        },
        adapters as AdapterPair<
          SourceAdapter<unknown, unknown, unknown>,
          DestinationAdapter
        >,
      );
    });

    it('should fix hyperlink urls', async () => {
      const result = await transformer.run(content);

      verifyUrl(result, HYPERLINKS, true);
      verifyUrl(result, IMAGE_URLS, false);
    });
  });

  describe('when relativeLinkBaseUrl defined', () => {
    beforeEach(async () => {
      adapters.sourceAdapter.getBaseUrl = () => 'https://the.dom.ain';

      await transformer.initialize(
        {},
        adapters as AdapterPair<
          SourceAdapter<unknown, unknown, unknown>,
          DestinationAdapter
        >,
      );
    });

    it('should resolve hyperlink urls', async () => {
      const result = await transformer.run(content);

      verifyUrl(result, RELATIVE_URLS, true);
    });
  });

  describe('when fixNonHttpsLinks & fixNonHttpsImages enabled', () => {
    beforeEach(async () => {
      await transformer.initialize(
        {
          fixNonHttpsLinks: 'true',
          fixNonHttpsImages: 'true',
        },
        adapters as AdapterPair<
          SourceAdapter<unknown, unknown, unknown>,
          DestinationAdapter
        >,
      );
    });

    it('should fix hyperlink & image urls', async () => {
      const result = await transformer.run(content);

      verifyUrl(result, HYPERLINKS, true);
      verifyUrl(result, IMAGE_URLS, true);
    });
  });

  function verifyUrl(
    content: ExternalContent,
    paths: string[],
    isSecure: boolean,
  ): void {
    paths.forEach((path) => {
      const url = _.get(content, path);
      expect(url).toMatch(isSecure ? /^https:\/\// : /^http:\/\//);
    });
  }

  function generateDocument(): Document {
    return {
      id: '',
      externalId: 'external-id',
      externalUrl: null,
      published: {
        title: 'document-title',
        visible: true,
        alternatives: null,
        variations: [
          {
            body: {
              blocks: [
                {
                  type: 'Paragraph',
                  paragraph: {
                    blocks: [
                      {
                        type: 'Text',
                        text: {
                          text: 'Link 1',
                          hyperlink: 'http://genesys.com/article=1',
                        },
                      },
                      {
                        type: 'Text',
                        text: {
                          text: 'RelativeLink 1',
                          hyperlink: '/article=1',
                        },
                      },
                    ],
                  },
                },
                {
                  type: 'OrderedList',
                  list: {
                    blocks: [
                      {
                        type: 'ListItem',
                        blocks: [
                          {
                            type: 'Text',
                            text: {
                              text: 'Link 2',
                              hyperlink: 'http://genesys.com/article=2',
                            },
                          },
                        ],
                      },
                      {
                        type: 'ListItem',
                        blocks: [
                          {
                            type: 'Image',
                            image: {
                              url: 'http://genesys.com/3.png',
                              hyperlink: 'http://genesys.com/article=3',
                            },
                          },
                          {
                            type: 'Image',
                            image: {
                              url: 'http://genesys.com/3.png',
                              hyperlink: '/article=3',
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
                {
                  type: 'Paragraph',
                  paragraph: {
                    blocks: [
                      {
                        type: 'Image',
                        image: {
                          url: 'http://genesys.com/4.jpg',
                          hyperlink: 'http://genesys.com/article=4',
                        },
                      },
                    ],
                  },
                },
                {
                  type: 'Table',
                  table: {
                    rows: [
                      {
                        cells: [
                          {
                            blocks: [
                              {
                                type: 'OrderedList',
                                list: {
                                  blocks: [
                                    {
                                      type: 'ListItem',
                                      blocks: [
                                        {
                                          type: 'Text',
                                          text: {
                                            text: 'Link 5',
                                            hyperlink:
                                              'http://genesys.com/article=5',
                                          },
                                        },
                                      ],
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                          {
                            blocks: [
                              {
                                type: 'Image',
                                image: {
                                  url: 'http://genesys.com/6.png',
                                  hyperlink: 'http://genesys.com/6',
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
        category: null,
        labels: [],
      },
      draft: null,
    };
  }

  function createSourceAdapter(): SourceAdapter<Category, Label, Document> {
    return {
      initialize: jest
        .fn<() => Promise<void>>()
        .mockReturnValue(Promise.resolve()),

      getAllCategories: jest.fn<() => Promise<Category[]>>(),

      getAllLabels: jest.fn<() => Promise<Label[]>>(),

      getAllArticles: jest.fn<() => Promise<Document[]>>(),

      getDocumentLinkMatcherRegexp: jest.fn<() => RegExp | undefined>(),

      getBaseUrl: jest.fn<() => string>(),
    };
  }
});
