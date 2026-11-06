import type { ReactNode } from "react";

import { FocusShell } from "@/components/layout/focus-shell";

// Sign-up, log-in and onboarding: no navigation, one task (decision 0002).
export default function FocusLayout({ children }: { children: ReactNode }) {
  return <FocusShell>{children}</FocusShell>;
}
