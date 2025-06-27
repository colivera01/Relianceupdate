"use client";
import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const Tooltip = RadixTooltip.Root;

const TooltipTrigger = RadixTooltip.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    />
  </RadixTooltip.Portal>
));
TooltipContent.displayName = RadixTooltip.Content.displayName;

// Simple wrapper for common usage
const SimpleTooltip: React.FC<{ content: React.ReactNode; children: React.ReactNode }> = ({ content, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{content}</TooltipContent>
  </Tooltip>
);

const TooltipProvider = RadixTooltip.Provider;

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, SimpleTooltip as default }; 