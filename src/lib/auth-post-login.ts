export type ServerNavigationTarget = Pick<Location, 'replace'>;

export function completeLoginWithFreshServerNavigation(
  destination: string,
  navigationTarget: ServerNavigationTarget = window.location
): void {
  navigationTarget.replace(destination);
}
