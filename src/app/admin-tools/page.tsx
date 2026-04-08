// Dev-only admin tools for seeding/resetting demo data
// /admin-tools
import "server-only";
import { redirect } from "next/navigation";

async function call(endpoint: string, body?: unknown) {
  // This runs on the server (server action), so we can safely use the secret
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return { ok: false, error: "SEED_SECRET is not set in .env.local" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    // Call the same Next app (internal)
    cache: "no-store",
  });

  try {
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

// SERVER ACTIONS
export async function seedAction() {
  "use server";
  // hit your seed endpoint
  const result = await call(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/admin/seed`);
  // stash result in a query param so we can show it after redirect
  const qp = new URLSearchParams({ action: "seed", ok: String(result.ok) });
  redirect(`/admin-tools?${qp.toString()}`);
}

export async function resetAction(formData: FormData) {
  "use server";
  const seedBatchId = (formData.get("seedBatchId") as string) || "";
  const body = seedBatchId ? { seedBatchId } : undefined;
  const result = await call(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/admin/reset`, body);
  const qp = new URLSearchParams({
    action: "reset",
    ok: String(result.ok),
    ...(seedBatchId ? { seedBatchId } : {}),
  });
  redirect(`/admin-tools?${qp.toString()}`);
}

export default async function AdminToolsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const action = (searchParams?.action as string) || "";
  const ok = (searchParams?.ok as string) || "";
  const batch = (searchParams?.seedBatchId as string) || "";

  const isProd = process.env.NODE_ENV === "production";

  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Admin Tools (Dev)</h1>

      {isProd ? (
        <div style={{ background: "#fee2e2", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Blocked in production.</strong> These tools only work in development.
        </div>
      ) : (
        <div style={{ background: "#ecfeff", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          These actions call <code>/api/admin/seed</code> and <code>/api/admin/reset</code> using your
          server-side <code>SEED_SECRET</code>. No secret is exposed to the browser.
        </div>
      )}

      {/* Seed */}
      <form action={seedAction} style={{ marginBottom: 16 }}>
        <button
          type="submit"
          style={{
            background: "#16a34a",
            color: "white",
            padding: "8px 12px",
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
          }}
          disabled={isProd}
        >
          Seed demo data
        </button>
      </form>

      {/* Reset */}
      <form action={resetAction} style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            name="seedBatchId"
            placeholder="(optional) seedBatchId to reset"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            type="submit"
            style={{
              background: "#ef4444",
              color: "white",
              padding: "8px 12px",
              borderRadius: 8,
              border: 0,
              cursor: "pointer",
            }}
            disabled={isProd}
          >
            Reset demo data
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
          Leave blank to reset all demo data, or paste a specific <code>seedBatchId</code>.
        </div>
      </form>

      {/* Simple feedback */}
      {action && (
        <div
          style={{
            background: ok === "true" ? "#dcfce7" : "#fee2e2",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {action === "seed" && ok === "true" && (
            <div>✅ Seed request sent. Check your pages for demo data.</div>
          )}
          {action === "seed" && ok !== "true" && <div>❌ Seed failed. Check server logs.</div>}

          {action === "reset" && ok === "true" && (
            <div>
              ✅ Reset request sent
              {batch ? ` for batch ${batch}` : ""}. Demo data should be gone.
            </div>
          )}
          {action === "reset" && ok !== "true" && <div>❌ Reset failed. Check server logs.</div>}
        </div>
      )}
    </div>
  );
}


