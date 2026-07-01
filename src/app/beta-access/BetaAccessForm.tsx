"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type BetaAccessFormProps = {
  returnTo: string;
  hasError: boolean;
};

export function BetaAccessForm({ returnTo, hasError }: BetaAccessFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action="/api/beta-gate" method="post" className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-blue-50">
          Beta access password
        </label>
        <div className="relative mt-2">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-white/12 bg-white py-3 pl-4 pr-14 text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
            placeholder="Enter beta password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            aria-label={showPassword ? "Hide beta password" : "Show beta password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {hasError ? (
        <div className="rounded-2xl border border-red-300/35 bg-red-500/12 p-4 text-sm text-red-50">
          Incorrect beta password. Try again or ask the Reliance beta owner for access.
        </div>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(37,99,235,0.32)] transition hover:bg-blue-500"
      >
        Continue to Reliance
      </button>
    </form>
  );
}
