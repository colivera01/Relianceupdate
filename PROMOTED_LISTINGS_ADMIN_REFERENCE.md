# Promoted Listings Admin Reference

Phase 2B.5 keeps promoted listings admin-managed. Stripe Payment Links can be recorded, but Reliance does not verify Stripe payments automatically yet.

## Packages

- Packages are managed in the **Editable Package Catalog** on `/admin/promoted-listings`.
- Package keys stay stable for reporting, while admins can edit name, price, active state, summary, internal notes, duration, radius, targeting, and founding-rate label.
- New campaigns store a package snapshot at creation so later package edits do not rewrite historical sold terms.
- Current seeded founding rates:
  - **7-day local spotlight**: `BROWSE_FEATURED`, 7 days, up to 10 miles, category targeting allowed, intro price $29.
  - **30-day local spotlight**: `BROWSE_FEATURED`, 30 days, up to 30 miles, category targeting allowed, intro price $89.
  - **7-day homepage spotlight**: `HOME_FEATURED`, 7 days, up to 30 miles, no category targeting, intro price $99. Homepage rendering is still deferred.

## Payment Statuses

- **Not started**: no payment work has started.
- **Pending payment**: campaign may be reserved, but is not eligible to go live.
- **Paid**: admin confirmed payment outside Reliance and recorded the reference.
- **Waived**: admin approved a no-charge campaign. It can activate but does not count as recorded revenue.
- **Refunded**: payment was reversed; the campaign should not remain active.

## Campaign Statuses

- **Draft**: setup state; not live.
- **Scheduled**: reserved for the selected window if package, vendor, service, and inventory rules pass.
- **Active**: eligible to render only when payment is paid or waived and the campaign is in-window.
- **Paused**: temporarily stopped by admin.
- **Ended, expired, cancelled, rejected**: non-live states.

## Stripe Payment Link Workflow

1. Choose package.
2. Set vendor, service, campaign window, placement zone, and radius.
3. Reserve the campaign as pending payment.
4. Paste the Stripe Payment Link URL or internal link reference.
5. After external payment confirmation, record the payment reference and mark the campaign paid.
6. Activate only when paid or waived.

Do not mark a campaign paid unless payment was confirmed outside Reliance. Webhooks, Stripe API verification, invoices, refunds, credits, and subscriptions remain intentionally deferred.
