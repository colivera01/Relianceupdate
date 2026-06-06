import fs from "node:fs";
import path from "node:path";
import { hashPassword, isPasswordHash } from "@/lib/auth-password";

type DevRegisteredUser = Record<string, any>;

const DEV_REGISTRY_FILE = path.join(process.cwd(), "tmp", "dev-registered-users.json");

const seededRegisteredUsers: DevRegisteredUser[] = [
  /** Browser E2E smoke (`e2e/booking-smoke.spec.ts`); Prisma row must exist with the same `id` (see `e2e/global-setup.ts`). */
  {
    id: "e2e-smoke-customer",
    firstName: "E2E",
    lastName: "Smoke",
    email: "e2e-smoke-customer@reliance.test",
    password: "E2E_Smoke_dev_only_9!",
    userType: "customer",
    address: "1 Smoke Test Lane",
    city: "Orlando",
    state: "FL",
    zipCode: "32801",
    bio: "",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    // Must match Prisma `users.id` — vendor-only MANAGER (0 customer bookings) for Metro Home Care Pros
    id: "cmohivpc60000sorokbuehp94",
    firstName: "E2E",
    lastName: "Trust Manager",
    email: "e2e-trust-manager@reliance.test",
    password: "E2E_Smoke_dev_only_9!",
    userType: "vendor",
    businessName: "Metro Home Care Pros",
    category: "Home Care",
    isActive: true,
    isVerified: true,
    isApproved: true,
    approvalStatus: "Approved",
    createdAt: new Date().toISOString(),
  },
  {
    // Employee-only Metro audit identity. The live login route resolves the real
    // Prisma user id by email, but the dev registry must still contain this
    // email/password so clean employee browser sessions can sign in.
    id: "e2e-trust-employee",
    firstName: "E2E",
    lastName: "Trust Employee",
    email: "e2e-trust-employee@reliance.test",
    password: "E2E_Smoke_dev_only_9!",
    userType: "customer",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    // Owner/admin identity (see internal-identities.ts). Internal-only for launch metrics;
    // still used for admin login and Sparkle vendor shell membership.
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
  {
    // Legacy dev registry only — no Prisma user/membership. Do NOT use for vendor audits.
    // Use e2e-trust-manager@reliance.test (Metro) per internal-identities AUDIT_ACCOUNTS.
    id: "test-vendor-1",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@sparkleclean.com",
    password: "vendor123!",
    userType: "vendor",
    address: "123 Business Ave",
    city: "Orlando",
    state: "Florida",
    zipCode: "32801",
    bio: "Professional cleaning services",
    businessName: "Sparkle Clean Pro",
    businessType: "Cleaning Services",
    category: "Home Cleaners",
    businessBio: "Professional cleaning services for homes and offices",
    foundedYear: "2020",
    licenseNumber: "FL-CLEAN-12345",
    insuranceStatus: "Insured",
    bondingStatus: "Bonded",
    totalEmployees: "5",
    yearsInBusiness: "4",
    serviceTypes:
      "Residential Cleaning, Commercial Cleaning, Deep Cleaning",
    specializations:
      "Eco-friendly cleaning, Move-in/out cleaning, Post-construction cleaning",
    serviceAreas: "Orlando, Winter Park, Maitland, Winter Springs",
    website: "https://sparklecleanpro.com",
    emergencyContact: "407-555-0123",
    responseTime: "2 hours",
    profileImage: "",
    isActive: true,
    isVerified: true,
    isApproved: true,
    approvalStatus: "Approved",
    rating: 4.8,
    totalReviews: 127,
    totalBookings: 89,
    totalEarnings: 15420,
    createdAt: new Date().toISOString(),
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
