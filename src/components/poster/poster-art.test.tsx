// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PosterArt } from "./poster-art";

afterEach(cleanup);

const base = { animeId: 7, romajiTitle: "Sousou no Frieren" } as const;

describe("PosterArt", () => {
  it("shows only the generated poster when there are no URLs", () => {
    render(<PosterArt {...base} nativeTitle="葬送のフリーレン" />);
    expect(screen.getByTestId("poster-fallback")).toBeTruthy();
    expect(screen.queryByTestId("poster-image")).toBeNull();
    expect(screen.getByTestId("poster-fallback").textContent).toContain(
      "葬送のフリーレン",
    );
  });

  it("keeps the generated poster underneath while the first image loads", () => {
    render(<PosterArt {...base} urls={["https://a.test/1.jpg"]} />);
    const image = screen.getByTestId("poster-image") as HTMLImageElement;
    expect(image.className).toContain("opacity-0");
    expect(screen.getByTestId("poster-fallback")).toBeTruthy();
    fireEvent.load(image);
    expect(image.className).toContain("opacity-100");
  });

  it("tries the next URL on error, in order", () => {
    render(
      <PosterArt
        {...base}
        urls={["https://a.test/1.jpg", "https://b.test/2.jpg"]}
      />,
    );
    expect((screen.getByTestId("poster-image") as HTMLImageElement).src).toBe(
      "https://a.test/1.jpg",
    );
    fireEvent.error(screen.getByTestId("poster-image"));
    expect((screen.getByTestId("poster-image") as HTMLImageElement).src).toBe(
      "https://b.test/2.jpg",
    );
  });

  it("falls back to the generated poster when every URL fails", () => {
    render(<PosterArt {...base} urls={["https://a.test/1.jpg"]} />);
    fireEvent.error(screen.getByTestId("poster-image"));
    expect(screen.queryByTestId("poster-image")).toBeNull();
    expect(screen.getByTestId("poster-fallback")).toBeTruthy();
  });

  it("starts the chain again when the URLs change", () => {
    const { rerender } = render(
      <PosterArt {...base} urls={["https://a.test/1.jpg"]} />,
    );
    fireEvent.error(screen.getByTestId("poster-image"));
    expect(screen.queryByTestId("poster-image")).toBeNull();
    rerender(<PosterArt {...base} urls={["https://c.test/3.jpg"]} />);
    const image = screen.getByTestId("poster-image") as HTMLImageElement;
    expect(image.src).toBe("https://c.test/3.jpg");
    expect(image.className).toContain("opacity-0");
  });

  it("hides its decorative text from assistive tech", () => {
    render(<PosterArt {...base} format="TV" year={2023} />);
    expect(
      screen.getByTestId("poster-fallback").getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
