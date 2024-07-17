import { Label } from '../../model/label.js';
import { Category } from '../../model/category.js';
import { Document } from '../../model/sync-export-model.js';
import { DocumentAlternative } from '../../model/document-alternative.js';
import { CategoryReference, LabelReference } from '../../model';

export function generateNormalizedLabel(
  suffix: string,
  id: string | null = null,
  name: string = 'label-name' + suffix,
  externalId: string = 'label-external-id' + suffix,
  sourceId: string | null = null,
): Label {
  return {
    id,
    name,
    externalId,
    ...(sourceId
      ? {
          sourceId,
        }
      : {}),
    color: 'generated-value-color',
  };
}

export function generateNormalizedCategory(
  suffix: string,
  id: string | null = null,
  name: string = 'category-name' + suffix,
  externalId: string = 'category-external-id' + suffix,
  parentCategory: CategoryReference | null = null,
  sourceId: string | null = null,
): Category {
  return {
    id,
    name,
    externalId,
    ...(sourceId
      ? {
          sourceId,
        }
      : {}),
    parentCategory,
  };
}

export function generateNormalizedDocument(
  suffix: string,
  id: string | null = null,
  title = 'article-title' + suffix,
  alternatives: DocumentAlternative[] | null = null,
  visible: boolean = true,
  externalId: string = 'article-external-id' + suffix,
  sourceId: string | null = null,
): Document {
  return {
    id,
    externalId,
    ...(sourceId
      ? {
          sourceId,
        }
      : {}),
    published: {
      title,
      visible,
      alternatives,
      variations: [
        {
          body: {
            blocks: [
              {
                image: {
                  url: 'https://document-image.url',
                },
                type: 'Image',
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

export function generateNormalizedDocumentWithInternalDocumentLinks(
  suffix: string,
  hyperlink: string | undefined = undefined,
  id: string | null = null,
  title = 'article-title' + suffix,
  alternatives: DocumentAlternative[] | null = null,
  visible: boolean = true,
  externalId: string = 'article-external-id' + suffix,
  sourceId: string | null = null,
): Document {
  return {
    id,
    externalId,
    ...(sourceId
      ? {
          sourceId,
        }
      : {}),
    published: {
      title,
      visible,
      alternatives,
      variations: [
        {
          body: {
            blocks: [
              {
                image: {
                  url: 'https://document-image.url',
                  hyperlink: hyperlink,
                  externalDocumentId: 'external-doc-id',
                },
                type: 'Image',
              },
              {
                paragraph: {
                  blocks: [
                    {
                      type: 'Text',
                      text: {
                        text: 'some text',
                        hyperlink: hyperlink,
                        externalDocumentId: 'external-doc-id',
                      },
                    },
                  ],
                },
                type: 'Paragraph',
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

export function generateDocumentWithTable(suffix: string): Document {
  return {
    id: '',
    externalId: 'documents-' + suffix,
    published: {
      title: 'document-title' + suffix,
      visible: true,
      alternatives: null,
      variations: [
        {
          body: {
            blocks: [
              {
                image: {
                  url: 'https://document-image.url',
                },
                type: 'Image',
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
                              type: 'Image',
                              image: {
                                url: 'https://table-image.url',
                              },
                            },
                          ],
                          properties: {
                            width: 14.5195,
                            borderColor: '#000000',
                          },
                        },
                        {
                          blocks: [
                            {
                              type: 'Text',
                              text: {
                                text: 'Table with image',
                              },
                            },
                          ],
                          properties: {
                            width: 2.2578125,
                            borderColor: '#000000',
                          },
                        },
                      ],
                    },
                    {
                      cells: [
                        {
                          blocks: [
                            {
                              type: 'Image',
                              image: {
                                url: '/sys_attachment.do?sys_id=1234\\',
                              },
                            },
                          ],
                          properties: {
                            width: 14.5195,
                            borderColor: '#000000',
                          },
                        },
                        {
                          blocks: [
                            {
                              type: 'Text',
                              text: {
                                text: 'Relative url',
                              },
                            },
                          ],
                          properties: {
                            width: 2.2578125,
                            borderColor: '#000000',
                          },
                        },
                      ],
                    },
                  ],
                  properties: {
                    width: 18.5625,
                  },
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

export function generateDocumentWithLinkedDocuments(suffix: string): Document {
  return {
    id: '',
    externalId: 'documents-' + suffix,
    published: {
      title: 'document-title' + suffix,
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
                        hyperlink:
                          'https://test.service-now.com/kb_view.do?sysparm_article=KB0012439',
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
                            hyperlink:
                              'https://test.service-now.com/kb_view.do?sysparm_article=KB0012439',
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
                            url: 'https://api-cdn.inindca.com/response-assets/v2/uploads/1d30ecab-5f52-4cfc-b2c0-895bbf05976f/6f7a568c-7811-4472-9f24-f4f306df8672.da879d57-ce15-4f1e-a9c0-77e015e1d179.png',
                            hyperlink:
                              'https://test.service-now.com/kb_view.do?sysparm_article=KB0012439',
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
                        url: 'https://api-cdn.inindca.com/response-assets/v2/uploads/1d30ecab-5f52-4cfc-b2c0-895bbf05976f/564b6dfe-79a1-446c-a2db-34ec3639499f.38546ccf-d2af-493b-b740-69a490a43bf0.jpg',
                        hyperlink:
                          'https://test.service-now.com/kb_view.do?sysparm_article=KB0012439',
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
                                            'https://test.service-now.com/kb_view.do?sysparm_article=KB0012439',
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
                                url: 'https://api-cdn.inindca.com/response-assets/v2/uploads/1d30ecab-5f52-4cfc-b2c0-895bbf05976f/6f7a568c-7811-4472-9f24-f4f306df8672.da879d57-ce15-4f1e-a9c0-77e015e1d179.png',
                                hyperlink:
                                  'https://test.service-now.com/kb_view.do?sysparm_article=KB0012439',
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

export function generateRawDocument(
  rawHtml: string = '',
  category: CategoryReference | null = null,
  labels: LabelReference[] | null = null,
): Document {
  return {
    id: null,
    externalId: 'article-external-id',
    published: {
      title: 'article-title',
      visible: true,
      alternatives: null,
      variations: [
        {
          body: null,
          rawHtml,
        },
      ],
      category,
      labels,
    },
    draft: null,
  };
}
