export class AttachmentDomainNotAllowedError extends Error {
  constructor(url: string) {
    super('Skipped downloading attachment, domain not allowed: ' + url);
  }
}
