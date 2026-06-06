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
      const raw = localStorage.getItem(key);
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window === 'undefined') return headers;

  const actor = getCurrentAdminActor();
  const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const isDev = process.env.NODE_ENV !== 'production';
  if (!token && isDev) {
    headers['x-user-role'] = 'admin';
    headers['x-admin'] = 'true';
  }

  if (!token && actor.adminId) {
    headers['x-user-id'] = actor.adminId;
  }

  return headers;
}
