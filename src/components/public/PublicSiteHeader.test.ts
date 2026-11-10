import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicSiteHeader } from './PublicSiteHeader';

describe('PublicSiteHeader account actions', () => {
  it('keeps public navigation available without showing guest actions during an account check', () => {
    const html = renderToStaticMarkup(
      createElement(PublicSiteHeader, {
        links: [{ href: '/help', label: 'Help' }],
        showAccountActions: false,
        hideLogo: true,
      })
    );

    expect(html).toContain('href="/help"');
    expect(html).not.toContain('href="/auth/login"');
    expect(html).not.toContain('href="/auth/register?type=user"');
  });

  it('shows guest account actions after anonymous status is known', () => {
    const html = renderToStaticMarkup(createElement(PublicSiteHeader, { hideLogo: true }));

    expect(html).toContain('href="/auth/login"');
    expect(html).toContain('href="/auth/register?type=user"');
  });
});
