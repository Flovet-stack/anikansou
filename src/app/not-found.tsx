import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { StatusScreen } from "@/components/layout/status-screen";
import { buttonVariants } from "@/components/ui/button";

// Rendered by the root layout for unknown URLs, so it brings the shell itself.
export default function NotFound() {
  return (
    <AppShell>
      <StatusScreen
        posterId={404}
        posterGlyph="迷子"
        posterChip="Ep 404"
        title="This episode doesn't exist"
        description="The page you were looking for isn't here. It may have moved, or the link is wrong."
        action={
          <Link href="/" className={buttonVariants()}>
            Go home
          </Link>
        }
      />
    </AppShell>
  );
}
