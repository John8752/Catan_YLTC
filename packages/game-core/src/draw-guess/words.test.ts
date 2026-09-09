import { expect, it } from "vitest";
import { wordSuggestions } from "./words.js";

it("retains the seeded prompt order when sharing the primitive shuffle", () => {
  expect(wordSuggestions(42, 3)).toEqual([
    ["小猫放风筝", "松鼠送外卖", "宇航员送外卖"],
    ["松鼠放风筝", "宇航员坐过山车", "企鹅送外卖"],
    ["企鹅放风筝", "小猫煮面条", "宇航员煮面条"],
  ]);
});
