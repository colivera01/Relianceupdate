'use client';

import { ArrowLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type PolicyReturnActionProps = {
  returnTo: string | null;
};

export function PolicyReturnAction({ returnTo }: PolicyReturnActionProps) {
  const router = useRouter();
  const isRegistrationReturn = Boolean(returnTo);

  const handleReturn = () => {
    if (isRegistrationReturn) {
      window.close();

      window.setTimeout(() => {
        if (!window.closed) {
          router.push(returnTo || '/auth/register');
        }
      }, 150);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  const Icon = isRegistrationReturn ? X : ArrowLeft;

  return (
    <button
      type="button"
      onClick={handleReturn}
      className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-[#0b1424] sm:w-auto"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {isRegistrationReturn ? 'Close and return to registration' : 'Back to Reliance'}
    </button>
  );
}
