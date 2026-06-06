import crypto from "crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { prisma } from "@/server/db";

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PASSKEY_RP_NAME = "Reliance";

type AuthCredentialRecord = {
  id: string;
  userId: string;
  email: string;
  emailVerifiedAt: Date | null;
  user: {
    id: string;
    name: string | null;
  } | null;
};

type AuthPasskeyRecord = {
  id: string;
  credentialId: string;
  credentialPublicKey: string;
  webauthnUserId: string;
  counter: number;
  transportsJson: string | null;
  deviceType: string;
  backedUp: boolean;
  label: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authCredentialId: string;
};

type AuthPasskeyChallengeRecord = {
  id: string;
  authCredentialId: string;
  challenge: string;
  purpose: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

function base64UrlToBuffer(value: string): Uint8Array {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function bufferToBase64Url(value: Uint8Array): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseTransports(value: string | null | undefined): AuthenticatorTransportFuture[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(Boolean) as AuthenticatorTransportFuture[];
  } catch {
    return undefined;
  }
}

function serializeTransports(
  transports: AuthenticatorTransportFuture[] | undefined
): string | null {
  if (!transports?.length) return null;
  return JSON.stringify(Array.from(new Set(transports.filter(Boolean))));
}

function resolvePasskeyRpId(request: Request): string {
  return new URL(request.url).hostname.toLowerCase();
}

function resolvePasskeyOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function findAuthCredentialByUserId(userId: string): Promise<AuthCredentialRecord | null> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;

  const credential = await (prisma as any).authCredential?.findUnique?.({
    where: { userId: normalizedUserId },
    select: {
      id: true,
      userId: true,
      email: true,
      emailVerifiedAt: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return credential ? (credential as AuthCredentialRecord) : null;
}

async function findAuthCredentialByEmail(email: string): Promise<AuthCredentialRecord | null> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const credential = await (prisma as any).authCredential?.findUnique?.({
    where: { email: normalizedEmail },
    select: {
      id: true,
      userId: true,
      email: true,
      emailVerifiedAt: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return credential ? (credential as AuthCredentialRecord) : null;
}

export async function listPasskeysForUser(userId: string): Promise<AuthPasskeyRecord[]> {
  const credential = await findAuthCredentialByUserId(userId);
  if (!credential?.id) return [];

  const passkeys = await (prisma as any).authPasskey?.findMany?.({
    where: {
      authCredentialId: credential.id,
      revokedAt: null,
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
  });

  return (passkeys || []) as AuthPasskeyRecord[];
}

export async function revokePasskeyForUser(params: {
  userId: string;
  passkeyId: string;
}) {
  const credential = await findAuthCredentialByUserId(params.userId);
  if (!credential?.id) {
    return { revoked: false as const, reason: "AUTH_CREDENTIAL_NOT_FOUND" };
  }

  const normalizedPasskeyId = String(params.passkeyId || "").trim();
  if (!normalizedPasskeyId) {
    return { revoked: false as const, reason: "PASSKEY_ID_REQUIRED" };
  }

  const passkey = ((await (prisma as any).authPasskey?.findFirst?.({
    where: {
      id: normalizedPasskeyId,
      authCredentialId: credential.id,
      revokedAt: null,
    },
  })) || null) as AuthPasskeyRecord | null;

  if (!passkey) {
    return { revoked: false as const, reason: "PASSKEY_NOT_FOUND" };
  }

  await (prisma as any).authPasskey.update({
    where: { id: passkey.id },
    data: {
      revokedAt: new Date(),
    },
  });

  return { revoked: true as const, passkeyId: passkey.id };
}

async function createPasskeyChallenge(params: {
  authCredentialId: string;
  challenge: string;
  purpose: "registration" | "authentication";
}) {
  return ((prisma as any).authPasskeyChallenge as any).create({
    data: {
      authCredentialId: params.authCredentialId,
      challenge: params.challenge,
      purpose: params.purpose,
      expiresAt: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS),
    },
  }) as Promise<AuthPasskeyChallengeRecord>;
}

async function consumePasskeyChallenge(params: {
  id: string;
  authCredentialId: string;
  purpose: "registration" | "authentication";
}) {
  const challenge = (await (prisma as any).authPasskeyChallenge?.findFirst?.({
    where: {
      id: params.id,
      authCredentialId: params.authCredentialId,
      purpose: params.purpose,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  })) as AuthPasskeyChallengeRecord | null;

  if (!challenge) return null;

  await (prisma as any).authPasskeyChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return challenge;
}

function mapPasskeyToWebAuthnCredential(passkey: AuthPasskeyRecord): WebAuthnCredential {
  return {
    id: passkey.credentialId,
    publicKey: base64UrlToBuffer(passkey.credentialPublicKey) as unknown as Uint8Array<ArrayBuffer>,
    counter: Number(passkey.counter || 0),
    transports: parseTransports(passkey.transportsJson),
  };
}

export async function createPasskeyRegistrationOptions(params: {
  userId: string;
  request: Request;
}) {
  const credential = await findAuthCredentialByUserId(params.userId);
  if (!credential?.id) {
    throw new Error("PASSKEY_CREDENTIAL_NOT_FOUND");
  }

  const existingPasskeys = await listPasskeysForUser(params.userId);
  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: resolvePasskeyRpId(params.request),
    userID: Buffer.from(credential.userId, "utf8"),
    userName: credential.email,
    userDisplayName: credential.user?.name || credential.email,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: parseTransports(passkey.transportsJson),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  const challenge = await createPasskeyChallenge({
    authCredentialId: credential.id,
    challenge: options.challenge,
    purpose: "registration",
  });

  return {
    authCredential: credential,
    challengeId: challenge.id,
    options,
  };
}

export async function verifyAndStorePasskeyRegistration(params: {
  userId: string;
  challengeId: string;
  response: RegistrationResponseJSON;
  request: Request;
}) {
  const credential = await findAuthCredentialByUserId(params.userId);
  if (!credential?.id) {
    throw new Error("PASSKEY_CREDENTIAL_NOT_FOUND");
  }

  const challenge = await consumePasskeyChallenge({
    id: params.challengeId,
    authCredentialId: credential.id,
    purpose: "registration",
  });
  if (!challenge) {
    throw new Error("PASSKEY_CHALLENGE_INVALID");
  }

  const verification = await verifyRegistrationResponse({
    response: params.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: resolvePasskeyOrigin(params.request),
    expectedRPID: resolvePasskeyRpId(params.request),
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("PASSKEY_REGISTRATION_FAILED");
  }

  const { registrationInfo } = verification;
  const storedPasskey = await ((prisma as any).authPasskey as any).upsert({
    where: { credentialId: registrationInfo.credential.id },
    create: {
      authCredentialId: credential.id,
      credentialId: registrationInfo.credential.id,
      credentialPublicKey: bufferToBase64Url(registrationInfo.credential.publicKey),
      webauthnUserId: bufferToBase64Url(Buffer.from(credential.userId, "utf8")),
      counter: registrationInfo.credential.counter,
      transportsJson: serializeTransports(params.response.response.transports),
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      label: registrationInfo.credentialDeviceType === "multiDevice" ? "Synced passkey" : "Device passkey",
      lastUsedAt: new Date(),
      revokedAt: null,
    },
    update: {
      authCredentialId: credential.id,
      credentialPublicKey: bufferToBase64Url(registrationInfo.credential.publicKey),
      webauthnUserId: bufferToBase64Url(Buffer.from(credential.userId, "utf8")),
      counter: registrationInfo.credential.counter,
      transportsJson: serializeTransports(params.response.response.transports),
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      lastUsedAt: new Date(),
      revokedAt: null,
    },
  });

  return {
    authCredential: credential,
    passkey: storedPasskey as AuthPasskeyRecord,
  };
}

export async function createPasskeyAuthenticationOptions(params: {
  email: string;
  request: Request;
}) {
  const credential = await findAuthCredentialByEmail(params.email);
  if (!credential?.id) {
    return null;
  }

  const passkeys = ((await (prisma as any).authPasskey?.findMany?.({
    where: {
      authCredentialId: credential.id,
      revokedAt: null,
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
  })) || []) as AuthPasskeyRecord[];

  if (!passkeys.length) {
    return null;
  }

  const options = await generateAuthenticationOptions({
    rpID: resolvePasskeyRpId(params.request),
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: parseTransports(passkey.transportsJson),
    })),
    userVerification: "required",
  });

  const challenge = await createPasskeyChallenge({
    authCredentialId: credential.id,
    challenge: options.challenge,
    purpose: "authentication",
  });

  return {
    authCredential: credential,
    challengeId: challenge.id,
    options,
  };
}

export async function verifyPasskeyAuthentication(params: {
  email: string;
  challengeId: string;
  response: AuthenticationResponseJSON;
  request: Request;
}) {
  const credential = await findAuthCredentialByEmail(params.email);
  if (!credential?.id) {
    throw new Error("PASSKEY_AUTH_CREDENTIAL_NOT_FOUND");
  }

  const challenge = await consumePasskeyChallenge({
    id: params.challengeId,
    authCredentialId: credential.id,
    purpose: "authentication",
  });
  if (!challenge) {
    throw new Error("PASSKEY_CHALLENGE_INVALID");
  }

  const passkey = ((await (prisma as any).authPasskey?.findFirst?.({
    where: {
      authCredentialId: credential.id,
      credentialId: params.response.id,
      revokedAt: null,
    },
  })) || null) as AuthPasskeyRecord | null;

  if (!passkey) {
    throw new Error("PASSKEY_NOT_REGISTERED");
  }

  const verification = await verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: resolvePasskeyOrigin(params.request),
    expectedRPID: resolvePasskeyRpId(params.request),
    credential: mapPasskeyToWebAuthnCredential(passkey),
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.authenticationInfo) {
    throw new Error("PASSKEY_AUTHENTICATION_FAILED");
  }

  const updatedPasskey = await (prisma as any).authPasskey.update({
    where: { id: passkey.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      deviceType: verification.authenticationInfo.credentialDeviceType,
      backedUp: verification.authenticationInfo.credentialBackedUp,
      lastUsedAt: new Date(),
    },
  });

  return {
    authCredential: credential,
    passkey: updatedPasskey as AuthPasskeyRecord,
  };
}

export function shapePasskeySummary(passkey: AuthPasskeyRecord) {
  return {
    id: passkey.id,
    label: passkey.label || (passkey.deviceType === "multiDevice" ? "Synced passkey" : "Device passkey"),
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString?.() ?? null,
  };
}

export type PasskeyRegistrationOptionsResult = {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

export type PasskeyAuthenticationOptionsResult = {
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
};
