export function mergeAuthoritativeVendorJobState(
  preservedClientJob: Record<string, unknown>,
  authoritativeServerJob: Record<string, unknown>,
) {
  return { ...preservedClientJob, ...authoritativeServerJob };
}
