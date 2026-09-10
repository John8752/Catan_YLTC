import { expect, it } from "vitest";
import { wordSuggestions } from "./words.js";
import { REGIONAL_NOUNS, BIRTHDAY_NOUNS, EVERYDAY_NOUNS } from "./word-bank.js";

it("gives six distinct seeded bank choices per player without overlap", () => {
  const suggestions = wordSuggestions(42, 6);
  expect(suggestions).toEqual(wordSuggestions(42, 6));
  expect(suggestions).toHaveLength(6);
  for (const choices of suggestions) expect(choices).toHaveLength(6);
  expect(new Set(suggestions.flat()).size).toBe(36);
  expect(wordSuggestions(43, 6)).not.toEqual(suggestions);
});

it("offers five nouns per hand and covers every requested regional and daily theme", () => {
  const regions = Object.values(REGIONAL_NOUNS);
  const nouns: readonly string[] = [...regions.flat(), ...BIRTHDAY_NOUNS, ...EVERYDAY_NOUNS];
  expect(new Set(nouns).size).toBe(nouns.length);
  expect(regions).toHaveLength(7);
  const seen = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const hands = wordSuggestions(seed, 6);
    expect(new Set(hands.flat()).size).toBe(36);
    for (const hand of hands) {
      expect(hand.filter((word) => nouns.includes(word))).toHaveLength(5);
      expect(regions.filter((words) => hand.some((word) => (words as readonly string[]).includes(word)))).toHaveLength(3);
      for (const word of hand) seen.add(word);
    }
  }
  for (const word of nouns) expect(seen.has(word), word).toBe(true);
});
