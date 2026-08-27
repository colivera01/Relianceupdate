import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const renderedShellSources = [
  'src/components/public/PublicSiteHeader.tsx',
  'src/components/public/PublicSiteFooter.tsx',
  'src/components/UserSidebar.tsx',
  'src/app/page.tsx',
  'src/app/browse/page.tsx',
  'src/app/(user)/discover/page.tsx',
  'src/app/(user)/user-dashboard/page.tsx',
  'src/app/(user)/service/[serviceId]/page.tsx',
  'src/app/vendors/[vendorId]/page.tsx',
  'src/app/help/page.tsx',
  'src/app/SidebarLayout.tsx',
  'src/app/admin/promoted-listings/page.tsx',
] as const;

describe('proof-first platform shell', () => {
  it('keeps the homepage proof comparison focused without the removed introduction block', () => {
    const source = read('src/app/page.tsx');

    expect(source).not.toContain('See real completed work before you decide who to trust.');
    expect(source).not.toContain('Proof-of-service platform');
    expect(source).not.toContain('See How Reliance Helps');
    expect(source).toContain('reliance-multitrade-collage-hero-v12.png');
    expect(source).toContain('Customer Reviews');
    expect(source).toContain('Public Service Videos');
    expect(source).toContain('Reliance Trust Score');
    expect(source).toContain('Services Offered without an approved Public Service Video');
  });

  it('uses proof-first navigation labels while preserving stable routes', () => {
    const publicHeader = read('src/components/public/PublicSiteHeader.tsx');
    const customerSidebar = read('src/components/UserSidebar.tsx');

    expect(publicHeader).toContain('{ href: "/browse", label: "Explore Proof" }');
    expect(customerSidebar).toContain("{ label: 'Explore Proof', icon: LayoutDashboard, href: '/discover'");
    expect(publicHeader).not.toContain('Browse Services');
    expect(customerSidebar).not.toContain('Browse Services');
  });

  it('does not expose superseded catalog or marketplace framing in active shell copy', () => {
    const combined = renderedShellSources.map(read).join('\n');

    expect(combined).not.toMatch(/Browse Services/i);
    expect(combined).not.toMatch(/Browse Vendor Services/i);
    expect(combined).not.toMatch(/Available Vendor Services/i);
    expect(combined).not.toMatch(/Vendor Services Near You/i);
    expect(combined).not.toMatch(/Reliance Listing/i);
    expect(combined).not.toMatch(/public Reliance marketplace/i);
    expect(combined).not.toMatch(/Promoted Listings/i);
  });

  it('keeps service requests supporting proof review rather than replacing it', () => {
    const servicePage = read('src/app/(user)/service/[serviceId]/page.tsx');

    expect(servicePage).toContain('Review proof before you choose');
    expect(servicePage).toContain('/booking/${serviceId}');
    expect(servicePage).toContain('Public profile');
    expect(servicePage).not.toContain('Reliance Listing');
  });

  it('uses role-appropriate operational language for vendors, employees, and admins', () => {
    const vendorLayout = read('src/app/vendor/layout.tsx');
    const employeePage = read('src/app/employee/jobs/page.tsx');
    const adminLayout = read('src/app/SidebarLayout.tsx');

    expect(vendorLayout).toContain("label: 'Service Video Activity'");
    expect(vendorLayout).toContain("label: 'Services Offered'");
    expect(vendorLayout).toContain("label: 'Manage Jobs'");
    expect(employeePage).toContain('Starting Condition');
    expect(employeePage).toContain('Work in Progress');
    expect(employeePage).toContain('Final Result');
    expect(adminLayout).toContain("label: 'Permission Audit'");
    expect(adminLayout).toContain("label: 'Featured Proof'");
  });
});
