import crypto from "crypto";

// In-memory storage for password reset tokens (in production, this would be a database)
const passwordResetTokens: Array<{
  email: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}> = [];

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function findUserByEmail(email: string) {
  const testUsers = [
    {
      id: "test-user-1",
      firstName: "Cesar",
      lastName: "Olivera",
      email: "colivera080124@gmail.com",
      password: "Co080124!",
      userType: "customer",
    },
  ];

  return testUsers.find((user) => user.email === email);
}

export function storePasswordResetToken(email: string): string {
  const resetToken = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  passwordResetTokens.push({
    email,
    token: resetToken,
    expiresAt,
    used: false,
  });

  return resetToken;
}

export function validateResetToken(token: string) {
  return passwordResetTokens.find(
    (rt) =>
      rt.token === token && rt.expiresAt > new Date() && !rt.used
  );
}

export function markTokenAsUsed(token: string) {
  const resetToken = passwordResetTokens.find((rt) => rt.token === token);
  if (resetToken) {
    resetToken.used = true;
  }
}

export { findUserByEmail };
