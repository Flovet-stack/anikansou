import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

// Pages with navigation: home, settings and every later section (decision 0002).
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
