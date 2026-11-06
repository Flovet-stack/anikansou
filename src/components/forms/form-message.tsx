import { cn } from "cn";

/** An error or success line for a form. Errors are announced to screen readers. */
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
      <p id={id} role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  return (
    <p
      id={id}
      role="status"
      className={cn("text-sm text-muted-foreground", !success && "sr-only")}
    >
      {success ?? ""}
    </p>
  );
}
