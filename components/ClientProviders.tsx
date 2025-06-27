"use client";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
} 