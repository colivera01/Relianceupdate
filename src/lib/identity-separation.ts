export type IdentitySeparationInput = {
  userId: string;
  credentialId: string;
  expectedUserName: string;
  expectedCurrentEmail: string;
  nextEmail: string;
  expectedAdminGrantId: string;
  expectedActiveMembershipCount: number;
  now?: Date;
};

type CountResult = { count: number };

type IdentitySeparationTransaction = {
  user: {
    findUnique: (args: Record<string, unknown>) => Promise<any>;
    findFirst: (args: Record<string, unknown>) => Promise<any>;
    updateMany: (args: Record<string, unknown>) => Promise<CountResult>;
  };
  authCredential: {
    findUnique: (args: Record<string, unknown>) => Promise<any>;
    findFirst: (args: Record<string, unknown>) => Promise<any>;
    updateMany: (args: Record<string, unknown>) => Promise<CountResult>;
  };
  vendorMembership: {
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  platformRoleGrant: {
    findUnique: (args: Record<string, unknown>) => Promise<any>;
  };
  authTrustedDevice: {
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<CountResult>;
  };
  authMfaChallenge: {
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<CountResult>;
  };
  emailVerificationToken: {
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<CountResult>;
  };
  authPasskeyChallenge: {
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<CountResult>;
  };
  employeeDecisionVerificationChallenge: {
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  employeeVerifiedDecisionSession: {
    count: (args: Record<string, unknown>) => Promise<number>;
  };
};

export type IdentitySeparationDb = {
  $transaction: <T>(
    callback: (tx: IdentitySeparationTransaction) => Promise<T>,
    options: { isolationLevel: "Serializable" }
  ) => Promise<T>;
};

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function exactText(value: unknown): string {
  return String(value ?? "").trim();
}

function assertCount(result: CountResult, expected: number, label: string) {
  if (Number(result?.count) !== expected) {
    throw new Error(`${label}_PREDICATE_FAILED`);
  }
}

export async function moveEmployeeCredentialEmailForIdentitySeparation(params: {
  db: IdentitySeparationDb;
  input: IdentitySeparationInput;
}) {
  const input = params.input;
  const expectedCurrentEmail = normalizeEmail(input.expectedCurrentEmail);
  const nextEmail = normalizeEmail(input.nextEmail);
  const expectedUserName = exactText(input.expectedUserName);
  const now = input.now ?? new Date();

  if (
    !exactText(input.userId) ||
    !exactText(input.credentialId) ||
    !expectedUserName ||
    !expectedCurrentEmail ||
    !nextEmail ||
    !exactText(input.expectedAdminGrantId) ||
    !Number.isInteger(input.expectedActiveMembershipCount) ||
    input.expectedActiveMembershipCount < 1
  ) {
    throw new Error("IDENTITY_SEPARATION_INPUT_INVALID");
  }
  if (expectedCurrentEmail === nextEmail) {
    throw new Error("IDENTITY_SEPARATION_EMAIL_UNCHANGED");
  }

  return params.db.$transaction(async (tx) => {
    const [user, credential, adminGrant, activeMembershipCount] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true, accountStatus: true },
      }),
      tx.authCredential.findUnique({
        where: { id: input.credentialId },
        select: { id: true, userId: true, email: true, emailVerifiedAt: true },
      }),
      tx.platformRoleGrant.findUnique({
        where: { id: input.expectedAdminGrantId },
        select: { id: true, userId: true, role: true, status: true },
      }),
      tx.vendorMembership.count({
        where: { userId: input.userId, status: "ACTIVE" },
      }),
    ]);

    if (
      !user ||
      String(user.id) !== input.userId ||
      exactText(user.name) !== expectedUserName ||
      exactText(user.accountStatus).toLowerCase() !== "active"
    ) {
      throw new Error("IDENTITY_SEPARATION_USER_PREDICATE_FAILED");
    }
    if (
      !credential ||
      String(credential.id) !== input.credentialId ||
      String(credential.userId) !== input.userId
    ) {
      throw new Error("IDENTITY_SEPARATION_CREDENTIAL_PREDICATE_FAILED");
    }
    if (
      !adminGrant ||
      String(adminGrant.id) !== input.expectedAdminGrantId ||
      String(adminGrant.userId) !== input.userId ||
      exactText(adminGrant.role).toUpperCase() !== "ADMIN" ||
      exactText(adminGrant.status).toUpperCase() !== "ACTIVE"
    ) {
      throw new Error("IDENTITY_SEPARATION_ADMIN_GRANT_PREDICATE_FAILED");
    }
    if (Number(activeMembershipCount) !== input.expectedActiveMembershipCount) {
      throw new Error("IDENTITY_SEPARATION_MEMBERSHIP_PREDICATE_FAILED");
    }

    const currentUserEmail = normalizeEmail(user.email);
    const currentCredentialEmail = normalizeEmail(credential.email);
    const alreadyMoved = currentUserEmail === nextEmail && currentCredentialEmail === nextEmail;
    if (!alreadyMoved && (
      currentUserEmail !== expectedCurrentEmail ||
      currentCredentialEmail !== expectedCurrentEmail
    )) {
      throw new Error("IDENTITY_SEPARATION_CURRENT_EMAIL_PREDICATE_FAILED");
    }
    if (alreadyMoved) {
      if (credential.emailVerifiedAt) {
        throw new Error("IDENTITY_SEPARATION_ALREADY_MOVED_AND_VERIFIED");
      }
      return {
        idempotent: true,
        userId: input.userId,
        credentialId: input.credentialId,
        email: nextEmail,
        revoked: {
          trustedDevices: 0,
          mfaChallenges: 0,
          emailVerificationTokens: 0,
          passkeyChallenges: 0,
        },
      };
    }

    const [userCollision, credentialCollision, employeeChallenges, employeeSessions] = await Promise.all([
      tx.user.findFirst({
        where: { email: nextEmail, id: { not: input.userId } },
        select: { id: true },
      }),
      tx.authCredential.findFirst({
        where: { email: nextEmail, id: { not: input.credentialId } },
        select: { id: true },
      }),
      tx.employeeDecisionVerificationChallenge.count({
        where: { userId: input.userId, consumedAt: null, expiresAt: { gt: now } },
      }),
      tx.employeeVerifiedDecisionSession.count({
        where: { userId: input.userId, consumedAt: null, expiresAt: { gt: now } },
      }),
    ]);
    if (userCollision || credentialCollision) {
      throw new Error("IDENTITY_SEPARATION_TARGET_EMAIL_IN_USE");
    }
    if (Number(employeeChallenges) !== 0 || Number(employeeSessions) !== 0) {
      throw new Error("IDENTITY_SEPARATION_ACTIVE_EMPLOYEE_VERIFICATION_STATE");
    }

    const activeTrustedWhere = {
      credentialId: input.credentialId,
      userId: input.userId,
      revokedAt: null,
      expiresAt: { gt: now },
    };
    const activeMfaWhere = {
      credentialId: input.credentialId,
      userId: input.userId,
      consumedAt: null,
      expiresAt: { gt: now },
    };
    const activeVerificationWhere = {
      credentialId: input.credentialId,
      consumedAt: null,
      expiresAt: { gt: now },
    };
    const activePasskeyChallengeWhere = {
      authCredentialId: input.credentialId,
      consumedAt: null,
      expiresAt: { gt: now },
    };

    const [trustedCount, mfaCount, verificationCount, passkeyChallengeCount] = await Promise.all([
      tx.authTrustedDevice.count({ where: activeTrustedWhere }),
      tx.authMfaChallenge.count({ where: activeMfaWhere }),
      tx.emailVerificationToken.count({ where: activeVerificationWhere }),
      tx.authPasskeyChallenge.count({ where: activePasskeyChallengeWhere }),
    ]);

    const [credentialUpdate, userUpdate, trustedUpdate, mfaUpdate, verificationUpdate, passkeyUpdate] =
      await Promise.all([
        tx.authCredential.updateMany({
          where: {
            id: input.credentialId,
            userId: input.userId,
            email: expectedCurrentEmail,
          },
          data: { email: nextEmail, emailVerifiedAt: null },
        }),
        tx.user.updateMany({
          where: { id: input.userId, email: expectedCurrentEmail },
          data: { email: nextEmail },
        }),
        tx.authTrustedDevice.updateMany({
          where: activeTrustedWhere,
          data: { revokedAt: now },
        }),
        tx.authMfaChallenge.updateMany({
          where: activeMfaWhere,
          data: { consumedAt: now },
        }),
        tx.emailVerificationToken.updateMany({
          where: activeVerificationWhere,
          data: { consumedAt: now },
        }),
        tx.authPasskeyChallenge.updateMany({
          where: activePasskeyChallengeWhere,
          data: { consumedAt: now },
        }),
      ]);

    assertCount(credentialUpdate, 1, "IDENTITY_SEPARATION_CREDENTIAL_UPDATE");
    assertCount(userUpdate, 1, "IDENTITY_SEPARATION_USER_UPDATE");
    assertCount(trustedUpdate, trustedCount, "IDENTITY_SEPARATION_TRUSTED_DEVICE_REVOKE");
    assertCount(mfaUpdate, mfaCount, "IDENTITY_SEPARATION_MFA_CONSUME");
    assertCount(
      verificationUpdate,
      verificationCount,
      "IDENTITY_SEPARATION_EMAIL_VERIFICATION_CONSUME"
    );
    assertCount(
      passkeyUpdate,
      passkeyChallengeCount,
      "IDENTITY_SEPARATION_PASSKEY_CHALLENGE_CONSUME"
    );

    const [updatedUser, updatedCredential] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      }),
      tx.authCredential.findUnique({
        where: { id: input.credentialId },
        select: { id: true, userId: true, email: true, emailVerifiedAt: true },
      }),
    ]);
    if (
      normalizeEmail(updatedUser?.email) !== nextEmail ||
      normalizeEmail(updatedCredential?.email) !== nextEmail ||
      String(updatedCredential?.userId || "") !== input.userId ||
      updatedCredential?.emailVerifiedAt
    ) {
      throw new Error("IDENTITY_SEPARATION_POSTCONDITION_FAILED");
    }

    return {
      idempotent: false,
      userId: input.userId,
      credentialId: input.credentialId,
      email: nextEmail,
      revoked: {
        trustedDevices: trustedUpdate.count,
        mfaChallenges: mfaUpdate.count,
        emailVerificationTokens: verificationUpdate.count,
        passkeyChallenges: passkeyUpdate.count,
      },
    };
  }, { isolationLevel: "Serializable" });
}
