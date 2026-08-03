type StoredAdminUser = {
  id?: unknown;
  email?: unknown;
  name?: unknown;
};

export type AdminActorMetadata = {
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function readStoredAdminUser(): StoredAdminUser | null {
  if (typeof window === 'undefined') return null;

  for (const key of ['userData', 'user']) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as StoredAdminUser;
    } catch {
      continue;
    }
  }

  return null;
}

export function getCurrentAdminActor(): AdminActorMetadata {
  const user = readStoredAdminUser();
  if (!user) return {};

  return {
    adminId: asNonEmptyString(user.id),
    adminEmail: asNonEmptyString(user.email),
    adminName: asNonEmptyString(user.name),
  };
}

export function getAdminRequestHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  };
}
