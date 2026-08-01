import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { sanitizePolicyReturnPath } from '@/lib/policy-navigation';
import { PolicyReturnAction } from './PolicyReturnAction';

type PolicyDocumentLayoutProps = {
  children: ReactNode;
  returnTo?: string | null;
};

export function PolicyDocumentLayout({ children, returnTo }: PolicyDocumentLayoutProps) {
  const safeReturnPath = sanitizePolicyReturnPath(returnTo);

  return (
    <main className="min-h-screen bg-[#050b15] px-4 py-5 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="sticky top-3 z-10 mb-5 flex flex-col gap-4 rounded-lg border border-slate-700 bg-[#0b1424]/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-400/30 bg-blue-500/10 text-blue-300">
              <FileText aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-white">Reliance policy document</p>
              <p className="mt-1 text-sm leading-5 text-slate-300">
                {safeReturnPath
                  ? 'This opened separately so your registration details remain in place.'
                  : 'Review this document, then return to Reliance when you are ready.'}
              </p>
            </div>
          </div>
          <PolicyReturnAction returnTo={safeReturnPath} />
        </header>

        <article className="policy-document rounded-lg border border-slate-700 bg-[#0b1424] px-5 py-7 shadow-2xl sm:px-9 sm:py-9">
          {children}
        </article>

        <div className="mt-5 flex justify-center sm:justify-end">
          <PolicyReturnAction returnTo={safeReturnPath} />
        </div>
      </div>
    </main>
  );
}
