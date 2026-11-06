import { cn } from "@/lib/utils";

import { PosterArt } from "./poster-art";

/**
 * Sample titles for decorative collages (home hero, auth screens). Fixed ids,
 * so the generated posters never change; no images are fetched (spec 04 #14).
 */
const SAMPLES = [
  {
    id: 101,
    romaji: "Sousou no Frieren",
    native: "葬送のフリーレン",
    format: "TV",
    year: 2023,
  },
  {
    id: 102,
    romaji: "Odd Taxi",
    native: "オッドタクシー",
    format: "TV",
    year: 2021,
  },
  {
    id: 103,
    romaji: "Kimi no Na wa.",
    native: "君の名は。",
    format: "Movie",
    year: 2016,
  },
  { id: 104, romaji: "Mushishi", native: "蟲師", format: "TV", year: 2005 },
  {
    id: 105,
    romaji: "Ping Pong the Animation",
    native: "ピンポン",
    format: "TV",
    year: 2014,
  },
  {
    id: 106,
    romaji: "Mononoke Hime",
    native: "もののけ姫",
    format: "Movie",
    year: 1997,
  },
  {
    id: 107,
    romaji: "Bocchi the Rock!",
    native: "ぼっち・ざ・ろっく！",
    format: "TV",
    year: 2022,
  },
  {
    id: 108,
    romaji: "Cowboy Bebop",
    native: "カウボーイビバップ",
    format: "TV",
    year: 1998,
  },
] as const;

/**
 * A staggered grid of generated posters. Purely decorative: hidden from
 * assistive tech.
 */
export function PosterCollage({
  count = 6,
  className,
}: {
  count?: 6 | 8;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("grid grid-cols-3 gap-3 md:gap-4", className)}
    >
      {SAMPLES.slice(0, count).map((sample, index) => (
        <div
          key={sample.id}
          // Middle column sits lower, for a staggered "wall of posters" look.
          className={cn(index % 3 === 1 && "translate-y-8")}
        >
          <PosterArt
            animeId={sample.id}
            romajiTitle={sample.romaji}
            nativeTitle={sample.native}
            format={sample.format}
            year={sample.year}
          />
        </div>
      ))}
    </div>
  );
}
