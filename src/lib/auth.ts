import { cookies } from 'next/headers';
// import jwt from 'jsonwebtoken'; // Uncomment when ready to use real JWT

interface JWTPayload {
  userId?: string;
  vendorId?: string;
  email?: string;
  role?: string;
}

/**
 * Extract and verify JWT token from cookies or headers
 * For now, this is stubbed to return vendorId: 1
 * TODO: Replace with real JWT verification when auth is fully implemented
 */
export async function verifyJwt(token: string): Promise<JWTPayload> {
  // TODO: Replace this stub with real JWT verification
  // Example implementation:
  // const secret = process.env.JWT_SECRET;
  // if (!secret) throw new Error('JWT_SECRET not configured');
  // const decoded = jwt.verify(token, secret) as JWTPayload;
  // return decoded;

  // Stub: For now, accept temp token and return default vendorId
  if (token === 'temp-jwt-token' || !token) {
    return { vendorId: '1', userId: '1' };
  }

  // In production, verify the actual JWT token here
  throw new Error('Invalid token');
}

/**
 * Get vendor ID from request (checks cookies first, then Authorization header)
 * 
 * TEMPORARY: For local development, this returns a hardcoded vendorId.
 * Replace with real auth extraction when JWT is fully implemented.
 */
export async function getVendorIdFromRequest(_request: Request): Promise<string | null> {
  // TEMPORARY: Local development only
  // Use your seeded vendor ID from Prisma Studio / seed script
  return 'cmipm4d6v0000sosgqvb8tp63'; // Sparkle Cleaning Pro (Cesar)
}

