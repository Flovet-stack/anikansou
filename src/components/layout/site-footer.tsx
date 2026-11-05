import { siteConfig } from "@/lib/seo/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        {siteConfig.name}: 感想, thoughts after watching.
      </div>
    </footer>
  );
}
