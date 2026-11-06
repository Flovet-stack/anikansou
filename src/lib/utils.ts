import { createCn } from "cn/config";

/**
 * Class-name merging that knows our type scale (decision 0001). Without this,
 * `cn` reads `text-body` as a text colour and drops `text-on-accent` (or the
 * other way round), so a button loses its label colour.
 */
export const TYPE_SCALE = [
  "caption",
  "small",
  "body",
  "title-s",
  "title-m",
  "title-l",
  "display-s",
  "display-l",
] as const;

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: [...TYPE_SCALE] }] } },
});
