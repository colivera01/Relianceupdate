'use client';

import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type InfoPopoverProps = {
  title: string;
  body: string;
  className?: string;
};

export function InfoPopover({ title, body, className }: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:text-blue-700",
            className
          )}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(7,16,38,0.14)]">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </PopoverContent>
    </Popover>
  );
}
