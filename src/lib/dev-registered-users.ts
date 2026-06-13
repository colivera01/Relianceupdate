import fs from "node:fs";
import path from "node:path";
import { hashPassword, isPasswordHash } from "@/lib/auth-password";

type DevRegisteredUser = Record<string, any>;

const DEV_REGISTRY_FILE = path.join(process.cwd(), "tmp", "dev-registered-users.json");

const seededRegisteredUsers: DevRegisteredUser[] = [
  {
    // Owner/admin identity (see internal-identities.ts). Keep this as the only
    // source-seeded fallback so local development can still recover admin access
    // after a full customer/vendor wipe.
    id: "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0",
    firstName: "Cesar",
    lastName: "Olivera",
    email: "colivera080124@gmail.com",
    password: "E2E_Smoke_dev_only_9!",
    userType: "customer",
    address: "407 Boxwood Circle",
    city: "Winter Springs",
    state: "Florida",
    zipCode: "32824",
    bio: "test test",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
];

declare global {
  var __relianceRegisteredUsers: DevRegisteredUser[] | undefined;
}

function replaceRegistryContents(target: DevRegisteredUser[], next: DevRegisteredUser[]) {
  target.splice(0, target.length, ...next);
}

function normalizeRegisteredEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function mergeRegistryRows(base: DevRegisteredUser[], overrides: DevRegisteredUser[]) {
  const merged = new Map<string, DevRegisteredUser>();

  for (const row of base) {
    const email = normalizeRegisteredEmail(row?.email);
    if (!email) continue;
    merged.set(email, { ...row });
  }

  for (const row of overrides) {
    const email = normalizeRegisteredEmail(row?.email);
    if (!email) continue;
    merged.set(email, {
      ...(merged.get(email) || {}),
      ...row,
    });
  }

  return Array.from(merged.values());
}

function normalizeCredentialShape(row: DevRegisteredUser): DevRegisteredUser {
  const normalized = { ...row };
  const legacyPassword = typeof normalized.password === "string" ? normalized.password.trim() : "";
  const currentHash = typeof normalized.passwordHash === "string" ? normalized.passwordHash.trim() : "";

  if (!currentHash && legacyPassword && !isPasswordHash(legacyPassword)) {
    normalized.passwordHash = hashPassword(legacyPassword);
  }

  return normalized;
}

function readPersistedRegisteredUsers(): DevRegisteredUser[] {
  try {
    if (!fs.existsSync(DEV_REGISTRY_FILE)) return [];
    const raw = fs.readFileSync(DEV_REGISTRY_FILE, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read persisted dev registered users:", error);
    return [];
  }
}

function persistRegisteredUsers(registry: DevRegisteredUser[]) {
  try {
    fs.mkdirSync(path.dirname(DEV_REGISTRY_FILE), { recursive: true });
    fs.writeFileSync(DEV_REGISTRY_FILE, JSON.stringify(registry, null, 2), "utf8");
  } catch (error) {
    console.warn("Failed to persist dev registered users:", error);
  }
}

function getRegisteredUsersStore(): DevRegisteredUser[] {
  if (!globalThis.__relianceRegisteredUsers) {
    globalThis.__relianceRegisteredUsers = mergeRegistryRows(
      seededRegisteredUsers.map((user) => normalizeCredentialShape({ ...user })),
      readPersistedRegisteredUsers().map((user) => normalizeCredentialShape({ ...user }))
    ).map((user) => normalizeCredentialShape(user));
  }
  return globalThis.__relianceRegisteredUsers;
}

// Shared dev-user store for login + registration routes in the running dev server.
export const registeredUsers = getRegisteredUsersStore();

export function syncRegisteredUsersFromDisk() {
  const registry = getRegisteredUsersStore();
  const merged = mergeRegistryRows(
    seededRegisteredUsers.map((user) => normalizeCredentialShape({ ...user })),
    readPersistedRegisteredUsers().map((user) => normalizeCredentialShape({ ...user }))
  ).map((user) => normalizeCredentialShape(user));
  replaceRegistryContents(registry, merged);
  globalThis.__relianceRegisteredUsers = registry;
  return registry;
}

export function addRegisteredUser(userData: any) {
  const registry = syncRegisteredUsersFromDisk();
  const normalizedUserData = normalizeCredentialShape({ ...userData });
  const emailNorm = normalizeRegisteredEmail(userData?.email);
  const existingIndex = registry.findIndex(
    (user) => normalizeRegisteredEmail(user?.email) === emailNorm
  );

  if (existingIndex >= 0) {
    registry[existingIndex] = {
      ...registry[existingIndex],
      ...normalizedUserData,
    };
  } else {
    registry.push(normalizedUserData);
  }

  persistRegisteredUsers(registry);

  console.log("User added to storage:", {
    ...normalizedUserData,
    password: "[HIDDEN]",
    passwordHash: normalizedUserData?.passwordHash ? "[HASHED]" : undefined,
    persistedInSharedRegistry: true,
  });
}

export function findRegisteredUserByEmail(email: string) {
  const emailNorm = normalizeRegisteredEmail(email);
  return syncRegisteredUsersFromDisk().find(
    (user) => normalizeRegisteredEmail(user?.email) === emailNorm
  );
}
