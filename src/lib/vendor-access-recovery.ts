export function isVendorManagerWorkflowPath(pathname: string | null | undefined): boolean {
  const normalized = String(pathname || '').trim();
  return normalized.startsWith('/vendor/jobs/');
}

export function vendorManagerRecoveryCopy(authenticated: boolean) {
  return authenticated
    ? {
        heading: 'Switch account to review this package',
        description:
          'This signed-in account does not have manager access to this Vendor work record. Sign in with an authorized Vendor Manager account to continue.',
        mode: 'switch-account' as const,
      }
    : {
        heading: 'Sign in to review this package',
        description:
          'Sign in with an authorized Vendor Manager account. Reliance will return you to this exact Service Record after sign-in.',
        mode: 'sign-in' as const,
      };
}
