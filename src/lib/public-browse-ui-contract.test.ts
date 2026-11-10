import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('public browse UI contract', () => {
  it('distinguishes anonymous public browsing from the signed-in customer experience', () => {
    const page = read('src/app/browse/page.tsx');

    expect(page).toContain('Public browsing — no account required');
    expect(page).toContain('You are still signed in — this is the public browsing view');
    expect(page).toContain('Customer Explore Work');
    expect(page).toContain('This page shows the same public-approved provider information any visitor can see.');
    expect(page).toContain('Sign in is required to save services, request service, or manage Service Records.');
    expect(page).toContain('resolvePublicBrowseNavigation');
  });

  it('preserves public-browse return context for service and provider details', () => {
    const page = read('src/app/browse/page.tsx');

    expect(page).toContain('const encodedBrowseReturnPath = encodeURIComponent(browseReturnPath);');
    expect(page).toContain('returnTo=${encodedBrowseReturnPath}&returnLabel=Back%20to%20Public%20Browse');
    expect(page).toContain("if (page > 1) params.set('page', String(page));");
    expect(page).not.toMatch(/(?:proofHref|providerHref)=\{`[^`]*returnTo=%2Fbrowse/);
    expect(page).not.toContain('returnTo=%2Fbrowse&returnLabel=Back%20to%20Explore%20Work');
    expect(page).not.toContain('returnTo=%2Fbrowse&returnLabel=Back%20to%20Browse%20Services');
  });

  it('keeps search, filters, categories, sharing, and pagination accessible', () => {
    const page = read('src/app/browse/page.tsx');

    expect(page).toContain('role="search"');
    expect(page).toContain('Search completed work, providers, or services offered');
    expect(page).not.toContain('Search completed work, providers, reviews, or services offered');
    expect(page).toContain('htmlFor="browse-search"');
    expect(page).toContain('htmlFor="browse-category"');
    expect(page).toContain('aria-expanded={showFilters}');
    expect(page).toContain('aria-controls="browse-advanced-filters"');
    expect(page).toContain('aria-pressed={selectedCategory === category.label}');
    expect(page).toContain('aria-label={`Share ${item.serviceName}`}');
    expect(page).toContain('role="status"');
    expect(page).toContain('aria-label="Browse result pages"');
    expect(page).toContain('All Public Work Categories');
    expect(page).not.toContain('All Services Offered');
    expect(page).toContain('No completed Public Service Videos are available yet. Check back soon.');
  });

  it('uses polished category labels and balances a single public result', () => {
    const page = read('src/app/browse/page.tsx');

    expect(page).toContain("electrician: { icon: '⚡'");
    expect(page).toContain("category.serviceCount === 1 ? 'service' : 'services'");
    expect(page).toContain("categories.length === 1");
    expect(page).toContain("displayResults.length === 1");
    expect(page).not.toContain("{ icon: '*', description:");
  });

  it('does not send non-customer signed-in roles to customer profile settings', () => {
    const page = read('src/app/browse/page.tsx');

    expect(page).toContain('browseNavigation.hasCustomerAccount');
    expect(page).toContain('Saved addresses are available in the customer account.');
  });

  it('keeps the footer account-aware instead of showing anonymous actions to signed-in users', () => {
    const page = read('src/app/browse/page.tsx');
    const footer = read('src/components/public/PublicSiteFooter.tsx');

    expect(page).toContain("accountHeading={");
    expect(page).toContain("{ href: '/discover', label: 'Customer Explore Work' }");
    expect(page).toContain("{ href: '/my-bookings', label: 'My Service Records' }");
    expect(page).toContain('accountLinksOverride={');
    expect(footer).toContain('exploreLinksOverride?: FooterLink[]');
    expect(footer).toContain('const displayedExploreLinks = exploreLinksOverride ?? exploreLinks');
  });
});
