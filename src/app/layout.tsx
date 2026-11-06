import { Bricolage_Grotesque, Onest } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { rootMetadata } from "@/lib/seo/metadata";

import "./globals.css";

// Display face for titles and big numbers (decision 0001).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

// UI and body face (decision 0001).
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata = rootMetadata;

// Never read cookies or headers here. This layout wraps every route, and doing
// so would stop catalog pages from being fully static. The app shell lives in
// the (app) and (focus) route group layouts.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      // `dark` is set here too, so the page is dark before (or without) JS.
      className={`${bricolage.variable} ${onest.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
