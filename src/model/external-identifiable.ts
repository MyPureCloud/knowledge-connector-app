export interface ExternalIdentifiable {
  id: string | null;
  externalId: string | null;
  externalIdAlternatives?: string[] | null;
  sourceId?: string | null;
  externalVersionId?: string | null;
}
