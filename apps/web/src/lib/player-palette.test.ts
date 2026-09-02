import { describe, expect, it } from "vitest";
import { PLAYER_SWATCH_CLASSES, PLAYER_TONE_CLASSES } from "./player-palette.js";

describe("player palette", () => {
  it("keeps all twelve player colors aligned across swatches and contextual tones", () => {
    expect(Object.keys(PLAYER_SWATCH_CLASSES)).toEqual([
      "terracotta",
      "ocean",
      "pine",
      "wheat",
      "plum",
      "charcoal",
      "coral",
      "orange",
      "navy",
      "emerald",
      "lavender",
      "graphite",
    ]);
    expect(Object.keys(PLAYER_TONE_CLASSES)).toEqual(Object.keys(PLAYER_SWATCH_CLASSES));
    expect(PLAYER_SWATCH_CLASSES.pine).toContain("#36afa6");
    expect(PLAYER_SWATCH_CLASSES.charcoal).toContain("#e3dccb");
  });
});
