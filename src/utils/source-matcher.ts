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

export function removeExternalIdPrefix(
  externalIdWithPrefix: string,
  externalIdPrefix: string | null,
): string {
  if (externalIdPrefix) {
    return externalIdWithPrefix.replace(new RegExp('^' + externalIdPrefix), '');
  }

  return externalIdWithPrefix;
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
