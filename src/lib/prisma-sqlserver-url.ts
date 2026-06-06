export function normalizePrismaSqlServerUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (!/^sqlserver:\/\//i.test(url)) return url;

  return url.replace(/(^|;)password=\{([^;}]*)\}(?=;|$)/i, '$1password=$2');
}
