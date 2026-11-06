import { cn } from "@/lib/utils";

import { HugeiconsBadgeAlertIcon } from "@/components/ui/hugeicons-badge-alert";
import { HugeiconsCheckIcon } from "@/components/ui/hugeicons-check";

/**
 * An error or success line for a form. Errors are announced to screen readers
 * and never rely on colour alone: they carry an icon (decision 0001).
 */
export function FormMessage({
  id,
  error,
  success,
}: {
  id?: string;
  error?: string | null;
  success?: string | null;
}) {
  if (error) {
    return (
      <p
        id={id}
        role="alert"
        className="flex items-start gap-2 text-small text-danger"
      >
        <HugeiconsBadgeAlertIcon size={18} aria-hidden className="mt-px" />
        <span>{error}</span>
      </p>
    );
  }
  return (
    <p
      id={id}
      role="status"
      className={cn(
        "flex items-start gap-2 text-small text-success",
        !success && "sr-only",
      )}
    >
      {success ? (
        <HugeiconsCheckIcon size={18} aria-hidden className="mt-px" />
      ) : null}
      <span>{success ?? ""}</span>
    </p>
  );
}
