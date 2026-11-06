import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons per decisions 0001 and 0007: pill-shaped, at least 44 px tall,
 * tint-and-lift hover on real pointers only (fast in, 150 ms out with `ease`),
 * and a press that scales to 0.97. The primary button has a darker "lip" that
 * flattens when pressed (design brief §10).
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-sans font-semibold whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,transform,filter] duration-(--duration-hover-out) ease-in-out hover-fine:duration-(--duration-fast)",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kohaku",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-kohaku text-on-accent shadow-lip hover-fine:bg-[color-mix(in_oklab,var(--kohaku)_88%,white)] active:translate-y-0.75 active:shadow-none",
        secondary: "bg-surface-2 text-foreground hover-fine:bg-surface-3",
        // Kept for existing call sites; looks the same as secondary.
        outline: "bg-surface-2 text-foreground hover-fine:bg-surface-3",
        ghost:
          "text-muted-foreground hover-fine:bg-surface-2 hover-fine:text-foreground",
        destructive:
          "bg-surface-2 text-danger hover-fine:bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface-2))]",
        link: "rounded-sm text-accent-text underline-offset-4 hover-fine:underline active:scale-100",
      },
      size: {
        default: "min-h-12 px-6 text-body",
        sm: "min-h-11 px-5 text-small",
        lg: "min-h-14 px-8 text-title-s",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
