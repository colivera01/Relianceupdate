import { PrismaClient } from "@prisma/client";
import { moveEmployeeCredentialEmailForIdentitySeparation } from "../../src/lib/identity-separation";

const TARGET_USER_ID = "cmqwvc0gp0003so84j1ckab1p";
const TARGET_CREDENTIAL_ID = "9cc52bf1-f902-4eb3-a2ef-89d20a96aebd";
const TARGET_ADMIN_GRANT_ID = "epic3_beta_admin_cmqwvc0gp0003so84j1ckab1p";
const TARGET_NAME = "Bradley Coopers";
const EXPECTED_ACTIVE_MEMBERSHIPS = 2;

function requiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  return `${local?.slice(0, 2) || "**"}***@${domain || "***"}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const expectedCurrentEmail = requiredEnv("IDENTITY_REPAIR_EXPECTED_EMAIL");
  const nextEmail = requiredEnv("IDENTITY_REPAIR_NEW_EMAIL");
  const prisma = new PrismaClient();
  try {
    const now = new Date();
    const [user, credential, targetUser, targetCredential, authCounts, employeeCounts] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: TARGET_USER_ID },
          select: {
            id: true,
            name: true,
            email: true,
            accountStatus: true,
            memberships: { select: { id: true, status: true, role: true } },
            platformRoleGrants: { select: { id: true, role: true, status: true } },
          },
        }),
        prisma.authCredential.findUnique({
          where: { id: TARGET_CREDENTIAL_ID },
          select: { id: true, userId: true, email: true, emailVerifiedAt: true },
        }),
        prisma.user.findFirst({
          where: { email: nextEmail, id: { not: TARGET_USER_ID } },
          select: { id: true },
        }),
        prisma.authCredential.findFirst({
          where: { email: nextEmail, id: { not: TARGET_CREDENTIAL_ID } },
          select: { id: true },
        }),
        Promise.all([
          prisma.authTrustedDevice.count({ where: { credentialId: TARGET_CREDENTIAL_ID } }),
          prisma.authTrustedDevice.count({
            where: {
              credentialId: TARGET_CREDENTIAL_ID,
              revokedAt: null,
              expiresAt: { gt: now },
            },
          }),
          prisma.authMfaChallenge.count({ where: { credentialId: TARGET_CREDENTIAL_ID } }),
          prisma.authMfaChallenge.count({
            where: {
              credentialId: TARGET_CREDENTIAL_ID,
              consumedAt: null,
              expiresAt: { gt: now },
            },
          }),
          prisma.emailVerificationToken.count({ where: { credentialId: TARGET_CREDENTIAL_ID } }),
          prisma.emailVerificationToken.count({
            where: {
              credentialId: TARGET_CREDENTIAL_ID,
              consumedAt: null,
              expiresAt: { gt: now },
            },
          }),
        ]),
        Promise.all([
          prisma.employeeDecisionVerificationChallenge.count({ where: { userId: TARGET_USER_ID } }),
          prisma.employeeDecisionVerificationChallenge.count({
            where: { userId: TARGET_USER_ID, consumedAt: null, expiresAt: { gt: now } },
          }),
          prisma.employeeVerifiedDecisionSession.count({ where: { userId: TARGET_USER_ID } }),
          prisma.employeeVerifiedDecisionSession.count({
            where: { userId: TARGET_USER_ID, consumedAt: null, expiresAt: { gt: now } },
          }),
          prisma.employeeRecordingParticipationDecision.count({ where: { userId: TARGET_USER_ID } }),
        ]),
      ]);

    const snapshot = {
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: maskEmail(String(user.email || "")),
            accountStatus: user.accountStatus,
            activeMemberships: user.memberships.filter((row) => row.status === "ACTIVE").length,
            activeAdminGrants: user.platformRoleGrants.filter(
              (row) => row.role === "ADMIN" && row.status === "ACTIVE"
            ).length,
          }
        : null,
      credential: credential
        ? {
            id: credential.id,
            userId: credential.userId,
            email: maskEmail(credential.email),
            emailVerified: Boolean(credential.emailVerifiedAt),
          }
        : null,
      expectedCurrentEmailMatches:
        String(user?.email || "").trim().toLowerCase() === expectedCurrentEmail.toLowerCase() &&
        String(credential?.email || "").trim().toLowerCase() === expectedCurrentEmail.toLowerCase(),
      targetAliasAvailable: !targetUser && !targetCredential,
      auth: {
        trustedDevicesTotal: authCounts[0],
        trustedDevicesActive: authCounts[1],
        mfaChallengesTotal: authCounts[2],
        mfaChallengesActive: authCounts[3],
        emailVerificationTokensTotal: authCounts[4],
        emailVerificationTokensActive: authCounts[5],
      },
      employeeVerification: {
        challengesTotal: employeeCounts[0],
        challengesActive: employeeCounts[1],
        sessionsTotal: employeeCounts[2],
        sessionsActive: employeeCounts[3],
        recordingParticipationDecisions: employeeCounts[4],
      },
    };

    if (!apply) {
      console.log(JSON.stringify({ mode: "CHECK", snapshot }, null, 2));
      return;
    }

    const result = await moveEmployeeCredentialEmailForIdentitySeparation({
      db: prisma as any,
      input: {
        userId: TARGET_USER_ID,
        credentialId: TARGET_CREDENTIAL_ID,
        expectedUserName: TARGET_NAME,
        expectedCurrentEmail,
        nextEmail,
        expectedAdminGrantId: TARGET_ADMIN_GRANT_ID,
        expectedActiveMembershipCount: EXPECTED_ACTIVE_MEMBERSHIPS,
      },
    });

    console.log(JSON.stringify({
      applied: true,
      idempotent: result.idempotent,
      userId: result.userId,
      credentialId: result.credentialId,
      email: maskEmail(result.email),
      revoked: result.revoked,
      preflight: snapshot,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
