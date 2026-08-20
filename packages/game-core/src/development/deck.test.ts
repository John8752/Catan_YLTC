import { describe, expect, it } from "vitest";
import { createDevelopmentDeck } from "./deck.js";

describe("development deck", () => {
  it("has the base composition and deterministic order", () => {
    const first = createDevelopmentDeck(42);
    const second = createDevelopmentDeck(42);
    const count = (type: string) => first.filter((card) => card === type).length;

    expect(first).toEqual(second);
    expect(first).toHaveLength(25);
    expect(count("knight")).toBe(14);
    expect(count("victory-point")).toBe(5);
    expect(count("road-building")).toBe(2);
    expect(count("monopoly")).toBe(2);
    expect(count("resource-choice")).toBe(2);
  });
});
