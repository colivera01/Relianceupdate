-- Version identity, not body uniqueness, is the canonical governed-content key.
-- Separately approved versions may intentionally retain byte-identical content.
DROP INDEX [governed_content_versions_key_hash_key]
  ON [dbo].[governed_content_versions];

CREATE NONCLUSTERED INDEX [governed_content_versions_key_hash_idx]
  ON [dbo].[governed_content_versions]([contentKey], [contentHash]);
