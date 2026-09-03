import path from 'node:path';
import { defineConfig } from 'vitest/config';

const artifact = process.env.RELIANCE_ARTIFACT_READONLY_ROOT;
if (!artifact) throw new Error('An extracted candidate artifact is required');

export default defineConfig({
  test: { environment: 'node', include: ['src/lib/customer-artifact-readonly.test.ts'], maxWorkers: 1 },
  resolve: { alias: {
    '@': path.resolve(__dirname, 'src'),
    '@prisma/client': path.resolve(artifact, 'node_modules/@prisma/client/default.js'),
  } },
});
