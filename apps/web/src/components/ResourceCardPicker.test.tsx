// @vitest-environment jsdom

import { resourceAmounts } from "@catan/game-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ResourceCardPalette, SelectedResourceCards } from "./ResourceCardPicker.js";

afterEach(() => cleanup());

describe("ResourceCardPicker", () => {
  it("adds one card per click without exceeding the hand", () => {
    render(<PickerHarness maximums={resourceAmounts({ brick: 2 })} />);
    const addBrick = screen.getByRole("button", { name: /在测试报价中加入 1 张砖/ });

    fireEvent.click(addBrick);
    fireEvent.click(addBrick);

    expect(screen.getByRole("button", { name: /从已选资源移除 1 张砖，当前 2 张/ })).toBeTruthy();
    expect((addBrick as HTMLButtonElement).disabled).toBe(true);
  });

  it("removes exactly one selected card per click", () => {
    render(<PickerHarness maximums={resourceAmounts({ ore: 3 })} initial={resourceAmounts({ ore: 2 })} />);

    fireEvent.click(screen.getByRole("button", { name: /从已选资源移除 1 张矿，当前 2 张/ }));

    expect(screen.getByRole("button", { name: /从已选资源移除 1 张矿，当前 1 张/ })).toBeTruthy();
  });
});

function PickerHarness({ maximums, initial = resourceAmounts({}) }: { readonly maximums: ReturnType<typeof resourceAmounts>; readonly initial?: ReturnType<typeof resourceAmounts> }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ResourceCardPalette label="测试报价" value={value} maximums={maximums} counts={maximums} onChange={setValue} />
      <SelectedResourceCards label="已选资源" value={value} onChange={setValue} />
    </>
  );
}
