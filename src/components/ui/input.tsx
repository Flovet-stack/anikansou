import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

/** Text input per decision 0001: surface-2 fill, 10 px radius, amber focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "min-h-12 w-full min-w-0 rounded-md border border-transparent bg-surface-2 px-4 text-body text-foreground transition-colors duration-(--duration-hover-out) ease-in-out outline-none placeholder:text-text-subtle",
        // Hover shows a hairline, not a lighter fill, so placeholders keep AA contrast.
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kohaku hover-fine:border-border hover-fine:duration-(--duration-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
