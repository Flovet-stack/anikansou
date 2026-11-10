import { startAnalytics } from "@/lib/analytics/analytics";

try {
  startAnalytics();
} catch {
  // Analytics must never stop the app from starting.
}
