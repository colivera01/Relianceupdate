'use server';

import 'server-only';
import { redirect } from 'next/navigation';

async function call(endpoint: string, body?: unknown) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return { ok: false, error: 'SEED_SECRET is not set in .env.local' };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  try {
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

export async function seedAction() {
  const result = await call(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/seed`);
  const qp = new URLSearchParams({ action: 'seed', ok: String(result.ok) });
  redirect(`/admin-tools?${qp.toString()}`);
}

export async function resetAction(formData: FormData) {
  const seedBatchId = (formData.get('seedBatchId') as string) || '';
  const body = seedBatchId ? { seedBatchId } : undefined;
  const result = await call(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/reset`, body);
  const qp = new URLSearchParams({
    action: 'reset',
    ok: String(result.ok),
    ...(seedBatchId ? { seedBatchId } : {}),
  });
  redirect(`/admin-tools?${qp.toString()}`);
}
