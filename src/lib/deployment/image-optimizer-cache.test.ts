import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const nextConfig = require('../../../next.config.js');

describe('image optimizer cache configuration', () => {
  it('keeps optimization enabled without writing a runtime disk cache', () => {
    expect(nextConfig.images).toMatchObject({
      maximumDiskCacheSize: 0,
    });
    expect(nextConfig.images.unoptimized).not.toBe(true);
  });
});
