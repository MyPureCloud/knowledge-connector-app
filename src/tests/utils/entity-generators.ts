import { Label } from '../../model/label.js';
import { Category } from '../../model/category.js';
import { Document } from '../../model/import-export-model.js';
import { ImportableContents } from '../../model/importable-contents.js';

export function generateLabel(
  suffix: string,
  name = 'label-name' + suffix,
): Label {
  return {
    id: '',
    name,
    externalId: 'labels-' + suffix,
    color: '',
  };
}

export function generateCategory(
  suffix: string,
  name = 'category-name' + suffix,
): Category {
  return {
    id: '',
    name,
    externalId: 'categories-' + suffix,
    parentCategory: null,
  };
}

export function generateDocument(
  suffix: string,
  title = 'document-name' + suffix,
): Document {
  return {
    id: '',
    externalId: 'documents-' + suffix,
    published: {
      title,
      visible: true,
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

export function generateDocumentWithTable(
  suffix: string,
  title = 'document-name' + suffix,
): Document {
  return {
    id: '',
    externalId: 'documents-' + suffix,
    published: {
      title,
      visible: true,
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
                type : 'Table',
                table : {
                  rows : [ {
                    cells : [ {
                      blocks : [ {
                        type : 'Image',
                        image : {
                          url : 'https://table-image.url'
                        }
                      } ],
                      properties: {
                        width : 14.5195,
                        borderColor : '#000000'
                      }
                    }, {
                      blocks : [ {
                        type : 'Text',
                        text : {
                          text : 'Table with image'
                        }
                      } ],
                      properties : {
                        width : 2.2578125,
                        borderColor : '#000000'
                      }
                    } ]
                  },
                    {
                      cells : [ {
                        blocks : [ {
                          type : 'Image',
                          image : {
                            url : '/sys_attachment.do?sys_id=1234\\'
                          }
                        } ],
                        properties: {
                          width : 14.5195,
                          borderColor : '#000000'
                        }
                      }, {
                        blocks : [ {
                          type : 'Text',
                          text : {
                            text : 'Relative url'
                          }
                        } ],
                        properties : {
                          width : 2.2578125,
                          borderColor : '#000000'
                        }
                      } ]
                    }],
                  properties : {
                    width : 18.5625
                  }
                }
              }
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

export function generateImportableContents(
  override: Partial<ImportableContents>,
): ImportableContents {
  return {
    labels: {
      created: [],
      updated: [],
      deleted: [],
      ...(override.labels || {}),
    },
    categories: {
      created: [],
      updated: [],
      deleted: [],
      ...(override.categories || {}),
    },
    documents: {
      created: [],
      updated: [],
      deleted: [],
      ...(override.documents || {}),
    },
  };
}
