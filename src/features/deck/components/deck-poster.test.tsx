// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_STATE } from "@/features/tracking/schemas";

import type { DeckCard } from "../types";
import { DeckPoster } from "./deck-poster";

afterEach(cleanup);

const card: DeckCard = {
  animeId: 1,
  title: "Test",
  nativeTitle: null,
  format: "TV",
  year: 2020,
  season: null,
  episodes: 12,
  durationMinutes: null,
  studios: [],
  tags: [],
  isUpcoming: false,
  isAdult: false,
  posterUrls: [],
  state: EMPTY_STATE,
};

describe("DeckPoster", () => {
  it("blurs an adult poster behind an 18+ badge until revealed (0010)", () => {
    const onReveal = vi.fn();
    const { container } = render(
      <DeckPoster
        card={{ ...card, isAdult: true }}
        revealed={false}
        onReveal={onReveal}
      />,
    );
    expect(screen.getByText("18+")).toBeTruthy();
    expect(container.querySelector(".blur-xl")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show poster (18+)" }));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows a revealed adult poster without the blur", () => {
    const { container } = render(
      <DeckPoster
        card={{ ...card, isAdult: true }}
        revealed
        onReveal={() => {}}
      />,
    );
    expect(container.querySelector(".blur-xl")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Show poster (18+)" }),
    ).toBeNull();
  });

  it("badges unaired anime as Upcoming", () => {
    render(
      <DeckPoster
        card={{ ...card, isUpcoming: true }}
        revealed={false}
        onReveal={() => {}}
      />,
    );
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });
});
