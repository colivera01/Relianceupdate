import fs from "node:fs";
import path from "node:path";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const STORE_FILE = path.join(process.cwd(), "tmp", "auth-failed-attempts.json");

type FailureRecord = {
  key: string;
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
};

function readStore(): FailureRecord[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(records: FailureRecord[]) {
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch {
    // Best-effort only.
  }
}

function cleanStore(records: FailureRecord[], now = Date.now()): FailureRecord[] {
  return records.filter((record) => {
    if (record.lockedUntil && record.lockedUntil > now) return true;
    return now - record.firstFailureAt <= WINDOW_MS;
  });
}

export function getAuthRateLimitKey(email: string, request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `${String(email || "").trim().toLowerCase()}|${ip}`;
}

export function getLoginThrottleState(key: string) {
  const now = Date.now();
  const records = cleanStore(readStore(), now);
  writeStore(records);
  const record = records.find((entry) => entry.key === key);
  if (!record?.lockedUntil || record.lockedUntil <= now) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
      failures: record?.failures || 0,
    };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
    failures: record.failures,
  };
}

export function recordFailedLoginAttempt(key: string) {
  const now = Date.now();
  const records = cleanStore(readStore(), now);
  const existing = records.find((entry) => entry.key === key);

  if (!existing || now - existing.firstFailureAt > WINDOW_MS) {
    const next: FailureRecord = {
      key,
      failures: 1,
      firstFailureAt: now,
      lockedUntil: null,
    };
    writeStore([...records.filter((entry) => entry.key !== key), next]);
    return next;
  }

  existing.failures += 1;
  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = now + LOCK_MS;
  }
  writeStore(records);
  return existing;
}

export function clearFailedLoginAttempts(key: string) {
  const records = readStore().filter((entry) => entry.key !== key);
  writeStore(records);
}
