const REGISTRATION_PATH = '/auth/register';

export function sanitizePolicyReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  try {
    const parsed = new URL(value, 'https://reliance.local');
    if (parsed.origin !== 'https://reliance.local' || parsed.pathname !== REGISTRATION_PATH) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function buildPolicyDocumentHref(policyPath: string, registrationPath: string): string {
  const safeReturnPath = sanitizePolicyReturnPath(registrationPath);
  if (!safeReturnPath) {
    return policyPath;
  }

  const query = new URLSearchParams({ returnTo: safeReturnPath });
  return `${policyPath}?${query.toString()}`;
}
