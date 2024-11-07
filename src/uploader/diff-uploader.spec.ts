import { describe, it } from '@jest/globals';

describe.skip('DiffUploader', () => {
  describe('when syncing from multiple sources', () => {
    describe('when externalIdPrefix given', () => {
      it('should remove entities with other externalIdPrefix from deleted', async () => {});
    });

    describe('when genesysSourceId given', () => {
      it('should remove entities with other sourceId from deleted', async () => {});
    });
  });
});
