import { ExternalIdentifiable } from '../model/external-identifiable.js';

export function isFromSameSource(
  item: ExternalIdentifiable,
  sourceId: string | null,
  externalIdPrefix: string | null,
): boolean {
  if (sourceId) {
    return isSourceIdMatch(item, sourceId);
  }

  if (externalIdPrefix) {
    return isExternalIdPrefixMatch(item, externalIdPrefix);
  }

  return hasExternalId(item);
}

function isSourceIdMatch(
  item: ExternalIdentifiable,
  sourceId: string,
): boolean {
  return item.sourceId === sourceId;
}

function isExternalIdPrefixMatch(
  item: ExternalIdentifiable,
  prefix: string,
): boolean {
  return !!item?.externalId && item.externalId.startsWith(prefix);
}

function hasExternalId(item: ExternalIdentifiable): boolean {
  return !!item?.externalId;
}
