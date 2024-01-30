import { Category } from '../../model/category.js';
import { Label } from '../../model/label.js';
import { Document } from '../../model/sync-export-model.js';
import { jest } from '@jest/globals';

export const SourceAdapter = jest.fn(() => ({
  getAllCategories: jest.fn<() => Promise<Category[]>>(),

  getAllLabels: jest.fn<() => Promise<Label[]>>(),

  getAllArticles: jest.fn<() => Promise<Document[]>>(),
}));
