// Dev-only admin tools for seeding/resetting demo data
// /admin-tools
import 'server-only';
import { resetAction, seedAction } from './actions';

export default async function AdminToolsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const action = (sp.action as string) || '';
  const ok = (sp.ok as string) || '';
  const batch = (sp.seedBatchId as string) || '';

  const isProd = process.env.NODE_ENV === 'production';

  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Admin Tools (Dev)</h1>

      {isProd ? (
        <div style={{ background: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Blocked in production.</strong> These tools only work in development.
        </div>
      ) : (
        <div style={{ background: '#ecfeff', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          These actions call <code>/api/admin/seed</code> and <code>/api/admin/reset</code> using your
          server-side <code>SEED_SECRET</code>. No secret is exposed to the browser.
        </div>
      )}

      {/* Seed */}
      <form action={seedAction} style={{ marginBottom: 16 }}>
        <button
          type="submit"
          style={{
            background: '#16a34a',
            color: 'white',
            padding: '8px 12px',
            borderRadius: 8,
            border: 0,
            cursor: 'pointer',
          }}
          disabled={isProd}
        >
          Seed demo data
        </button>
      </form>

      {/* Reset */}
      <form action={resetAction} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            name="seedBatchId"
            placeholder="(optional) seedBatchId to reset"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />
          <button
            type="submit"
            style={{
              background: '#ef4444',
              color: 'white',
              padding: '8px 12px',
              borderRadius: 8,
              border: 0,
              cursor: 'pointer',
            }}
            disabled={isProd}
          >
            Reset demo data
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
          Leave blank to reset all demo data, or paste a specific <code>seedBatchId</code>.
        </div>
      </form>

      {/* Simple feedback */}
      {action && (
        <div
          style={{
            background: ok === 'true' ? '#dcfce7' : '#fee2e2',
            padding: 12,
            borderRadius: 8,
          }}
        >
          {action === 'seed' && ok === 'true' && (
            <div>✅ Seed request sent. Check your pages for demo data.</div>
          )}
          {action === 'seed' && ok !== 'true' && <div>❌ Seed failed. Check server logs.</div>}

          {action === 'reset' && ok === 'true' && (
            <div>
              ✅ Reset request sent
              {batch ? ` for batch ${batch}` : ''}. Demo data should be gone.
            </div>
          )}
          {action === 'reset' && ok !== 'true' && <div>❌ Reset failed. Check server logs.</div>}
        </div>
      )}
    </div>
  );
}
