import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('public service detail launch contract', () => {
  it('shows public pricing and keeps vendor contact details private', () => {
    const page = read('src/app/(user)/service/[serviceId]/page.tsx');
    const route = read('src/app/api/services/[id]/route.ts');

    expect(page).toContain('Reference price');
    expect(page).toContain('Reliance keeps private contact details off public pages.');
    expect(page).not.toContain('service.vendor.phone');
    expect(page).not.toContain('getPublicVendorEmail');
    expect(page).not.toContain('publicContactHref');
    expect(route).not.toContain('phone: true');
    expect(route).not.toContain('email: true');
  });

  it('keeps vendor ratings separate from service reviews and fails optional enrichment honestly', () => {
    const page = read('src/app/(user)/service/[serviceId]/page.tsx');
    const route = read('src/app/api/services/[id]/route.ts');

    expect(page).toContain('verified customer rating');
    expect(page).toContain('Reviews (${servicePublicReviewCount})');
    expect(page).toContain('Customer reviews could not load right now.');
    expect(page).toContain('Try loading reviews again');
    expect(page).toContain("service?.publicMediaStatus === 'temporarily_unavailable'");
    expect(route).toContain("publicMediaStatus: 'available' | 'temporarily_unavailable'");
    expect(route).toContain('getPublicServiceDescriptionPresentation');
  });
});
