import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('customer notification and account-accessibility UI contract', () => {
  it('gives Secure Account a page heading and mobile More navigation entry', () => {
    const secureAccount = read('src/app/customer/secure-account/page.tsx');
    const passkeys = read('src/components/auth/PasskeySetupCard.tsx');
    const sidebar = read('src/components/UserSidebar.tsx');
    expect(secureAccount).toContain('<h1 className="mt-2 text-3xl font-semibold">Secure Account</h1>');
    expect(secureAccount).toContain('headingLevel="h2"');
    expect(passkeys).toContain("const Heading = props.headingLevel || (props.embedded ? 'h2' : 'h1')");
    expect(sidebar).toContain("{ label: 'Secure Account', mobileLabel: 'Account'");
    expect(sidebar).toContain('aria-label="More customer navigation"');
    expect(sidebar).toContain("if (event.key !== 'Escape') return;");
    expect(sidebar).toContain('mobileMoreFirstLinkRef.current?.focus()');
    expect(sidebar).toContain('mobileMoreButtonRef.current?.focus()');
    expect(sidebar).toContain("href.split(/[?#]/, 1)[0]");
  });

  it('exposes Notifications in desktop and mobile navigation without overcrowding the fixed bar', () => {
    const sidebar = read('src/components/UserSidebar.tsx');
    expect(sidebar).toContain("{ label: 'Notifications', mobileLabel: 'Alerts'");
    expect(sidebar).toContain('grid-cols-5');
    expect(sidebar).toContain('<span>More</span>');
  });

  it('uses ordinary pressed filter buttons instead of incomplete tab semantics', () => {
    const page = read('src/app/(user)/notifications/page.tsx');
    expect(page).toContain('role="group" aria-label="Notification filters"');
    expect(page).toContain('aria-pressed={filter === value}');
    expect(page).not.toContain('role="tab"');
    expect(page).not.toContain('role="tabpanel"');
    expect(page).toContain('`Recent (${notifications.length})`');
    expect(page).toContain('`Unread shown (${shownUnreadCount})`');
    expect(page).toContain('Showing the most recent {notifications.length} of {totalCount} notifications.');
    expect(page).toContain("setStatusMessage('Notification marked read.')");
    expect(page).toContain('aria-label={`Mark notification about ${notification.serviceName} as read`}');
    expect(page).toContain('aria-label={`Open Service Record for ${notification.serviceName}`}');
  });

  it('keeps passkey management and recovery available in unsupported browsers with safe focus', () => {
    const passkeys = read('src/components/auth/PasskeySetupCard.tsx');
    expect(passkeys).not.toContain('if (!isSupported)');
    expect(passkeys).toContain('You can still review and remove existing passkeys below');
    expect(passkeys).toContain('disabled={isSupported !== true || isSettingUp || isLoadingPasskeys}');
    expect(passkeys).toContain('confirmRemovalRef.current?.focus()');
    expect(passkeys).toContain('removeButtonRefs.current.get(passkeyId)?.focus()');
    expect(passkeys).toContain('current.filter((passkey) => passkey.id !== passkeyId)');
    expect(passkeys).toContain('setStatusMessage(`${removedLabel} removed.`)');
    expect(passkeys).toContain('statusMessageRef.current?.focus()');
    expect(passkeys).toContain('Passkey action failed');
    expect(passkeys).toContain('aria-label={`Remove ${passkey.label}`}');
    expect(passkeys).toContain('aria-label={`Confirm removal of ${passkey.label}`}');
    expect(passkeys).toContain('aria-describedby={removalPromptId}');
    expect(passkeys).not.toContain('await loadPasskeys();\n    } catch (err)');
  });

  it('backfills only allowlisted historical customer activity before creating the read index', () => {
    const migration = read('prisma/migrations/20261104012000_add_customer_notification_read_state/migration.sql');
    expect(migration.match(/EXEC sys\.sp_executesql N'/g)).toHaveLength(2);
    expect(migration).toContain('UPDATE notification');
    expect(migration).toContain("N''CUSTOMER_CONSENT_REQUEST''");
    expect(migration).toContain("N''CUSTOMER_PERMISSION_REQUEST''");
    expect(migration).toContain("N''CUSTOMER_RECORDING_NOTICE''");
    expect(migration).toContain("LIKE N''SERVICE[_]REQUEST[_]ACCEPTED[_]CUSTOMER[_]V1:%''");
    expect(migration).toContain('AND @customerReadAtAdded = 1');
    expect(migration.indexOf('UPDATE notification')).toBeLessThan(migration.indexOf('CREATE INDEX'));
  });
});
