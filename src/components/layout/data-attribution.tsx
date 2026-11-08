import { cn } from "@/lib/utils";

/**
 * The credit the ODbL dataset requires (README, "Data source"). Shown in the
 * sidebar footer on desktop and at the bottom of Settings on phones.
 */
export function DataAttribution({ className }: { className?: string }) {
  const link =
    "underline decoration-text-subtle underline-offset-2 hover-fine:text-foreground";
  return (
    <p className={cn("text-caption text-text-subtle", className)}>
      Anime data from{" "}
      <a
        className={link}
        href="https://github.com/cedya77/anime-offline-database"
      >
        cedya77/anime-offline-database
      </a>
      , which continues the archived{" "}
      <a
        className={link}
        href="https://github.com/manami-project/anime-offline-database"
      >
        manami-project/anime-offline-database
      </a>
      . Made available under the{" "}
      <a className={link} href="https://opendatacommons.org/licenses/odbl/1-0/">
        Open Database License 1.0
      </a>
      , with contents under the{" "}
      <a className={link} href="https://opendatacommons.org/licenses/dbcl/1-0/">
        Database Contents License 1.0
      </a>
      . Cover images:{" "}
      <a className={link} href="https://anilist.co">
        AniList
      </a>
      .
    </p>
  );
}
