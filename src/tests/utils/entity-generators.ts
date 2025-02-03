import { Label } from '../../model/label.js';
import { Category } from '../../model/category.js';
import { Document } from '../../model/document.js';
import { DocumentAlternative } from '../../model/document-alternative.js';
import { CategoryReference, LabelReference } from '../../model';

export const LINKED_ARTICLE_ID = 'KB0012439';
export const ARTICLE_LINK = `https://genesys.com/kb_view.do?sysparm_article=${LINKED_ARTICLE_ID}`;

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
    externalUrl: null,
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
  hyperlink: string | null = null,
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
    externalUrl: null,
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
                  ...(hyperlink ? { hyperlink } : {}),
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
                        ...(hyperlink ? { hyperlink } : {}),
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
    externalUrl: null,
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
    externalUrl: null,
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
                        hyperlink: ARTICLE_LINK,
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
                            hyperlink: ARTICLE_LINK,
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
                            url: 'https://genesys.com/1.png',
                            hyperlink: ARTICLE_LINK,
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
                        url: 'https://genesys.com/2.jpg',
                        hyperlink: ARTICLE_LINK,
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
                                          hyperlink: ARTICLE_LINK,
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
                                url: 'https://genesys.com/3.png',
                                hyperlink: ARTICLE_LINK,
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
  externalId: string = 'article-external-id',
): Document {
  return {
    id: null,
    externalId,
    externalUrl: null,
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
