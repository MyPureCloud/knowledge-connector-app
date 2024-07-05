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
