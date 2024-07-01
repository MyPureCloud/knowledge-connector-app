import { Config } from '../config.js';

export interface LoaderConfig extends Config {
  fetchCategories?: string;
  fetchLabels?: string;
  fetchArticles?: string;
}
