import { expect, it } from "vitest";
import { wordSuggestions } from "./words.js";

it("gives six distinct seeded bank choices per player without overlap", () => {
  const suggestions = wordSuggestions(42, 6);
  expect(suggestions).toEqual(wordSuggestions(42, 6));
  expect(suggestions).toHaveLength(6);
  for (const choices of suggestions) expect(choices).toHaveLength(6);
  expect(new Set(suggestions.flat()).size).toBe(36);
  expect(suggestions[0]).toEqual(["小猫放风筝", "松鼠送外卖", "宇航员送外卖", "松鼠放风筝", "宇航员坐过山车", "企鹅送外卖"]);
  expect(wordSuggestions(43, 6)).not.toEqual(suggestions);
});
