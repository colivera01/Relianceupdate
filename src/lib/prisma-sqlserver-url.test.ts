import { describe, expect, it } from 'vitest';

import { normalizePrismaSqlServerUrl } from './prisma-sqlserver-url';

describe('normalizePrismaSqlServerUrl', () => {
  it('unwraps a braced sqlserver password for Prisma compatibility', () => {
    expect(
      normalizePrismaSqlServerUrl(
        'sqlserver://example.database.windows.net:1433;database=reliance-db;user=test;password={Secret123!};encrypt=true;trustServerCertificate=false'
      )
    ).toBe(
      'sqlserver://example.database.windows.net:1433;database=reliance-db;user=test;password=Secret123!;encrypt=true;trustServerCertificate=false'
    );
  });

  it('leaves already-compatible sqlserver URLs unchanged', () => {
    const url =
      'sqlserver://example.database.windows.net:1433;database=reliance-db;user=test;password=Secret123!;encrypt=true;trustServerCertificate=false';

    expect(normalizePrismaSqlServerUrl(url)).toBe(url);
  });

  it('does not modify non-sqlserver URLs', () => {
    const url = 'postgresql://postgres:secret@localhost:5432/reliance';

    expect(normalizePrismaSqlServerUrl(url)).toBe(url);
  });
});
