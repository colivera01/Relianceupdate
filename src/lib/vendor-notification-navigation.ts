export async function navigateAfterNotificationRead(input: {
  href: string;
  markRead: () => Promise<unknown>;
  navigate: (href: string) => void;
  onReadError?: (error: unknown) => void;
}) {
  try {
    await input.markRead();
  } catch (error) {
    input.onReadError?.(error);
  } finally {
    input.navigate(input.href);
  }
}
