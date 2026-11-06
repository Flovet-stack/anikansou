import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps a text colour next to one of our text sizes", () => {
    expect(cn("text-on-accent", "text-body")).toBe("text-on-accent text-body");
    expect(cn("text-small text-muted-foreground", "text-accent-text")).toBe(
      "text-small text-accent-text",
    );
  });

  it("still lets a later size or colour win over an earlier one", () => {
    expect(cn("text-body", "text-title-s")).toBe("text-title-s");
    expect(cn("text-muted-foreground", "text-foreground")).toBe(
      "text-foreground",
    );
  });
});
