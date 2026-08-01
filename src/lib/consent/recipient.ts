import { hashOpaqueSecret } from "./token";

export function normalizePermissionEmail(value: unknown): string | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

export function normalizePermissionPhone(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
}

export function hashPermissionContact(value: string | null): string | null {
  return value ? hashOpaqueSecret(`permission-contact:${value}`) : null;
}

export function maskPermissionEmail(value: string | null): string | null {
  if (!value) return null;
  const [local, domain] = value.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPermissionPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4
    ? `+${digits.slice(0, Math.max(1, digits.length - 7))} *** *** ${digits.slice(-4)}`
    : "***";
}

export function buildPermissionRecipient(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const email = normalizePermissionEmail(input.email);
  const phone = normalizePermissionPhone(input.phone);
  return {
    name: String(input.name || "").trim() || null,
    email,
    phone,
    emailHash: hashPermissionContact(email),
    phoneHash: hashPermissionContact(phone),
    emailMasked: maskPermissionEmail(email),
    phoneMasked: maskPermissionPhone(phone),
  };
}
