import * as RadixPopover from '@radix-ui/react-popover';
import React from 'react';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(({ className, ...props }, ref) => (
  <RadixPopover.Content
    ref={ref}
    align="center"
    sideOffset={8}
    className={
      'z-50 rounded border bg-white p-4 shadow-lg outline-none animate-fade-in ' +
      (className || '')
    }
    {...props}
  />
));
PopoverContent.displayName = 'PopoverContent';
