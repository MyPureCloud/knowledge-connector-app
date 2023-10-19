import { Category } from '../../model/category.js';
import { Label } from '../../model/label.js';
import { Document } from '../../model/import-export-model.js';

export const SourceAdapter = jest.fn(() => ({
  getAllCategories: jest.fn<Promise<Category[]>, any[], any>(),

  getAllLabels: jest.fn<Promise<Label[]>, any[], any>(),

  getAllArticles: jest.fn<Promise<Document[]>, any[], any>(),
}));
