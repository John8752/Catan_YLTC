// @vitest-environment jsdom
import { resourceAmounts } from "@catan/game-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BankSupplyButton } from "./BankSupplyButton.js";

afterEach(cleanup);

it("discloses live bank stock on demand while retaining exactly one effect anchor", () => {
  const { rerender } = render(<BankSupplyButton resources={resourceAmounts({ brick: 19 })} />);
  expect(document.querySelectorAll('[data-resource-source="bank"]')).toHaveLength(1);
  expect(screen.queryByRole("region", { name: "银行剩余资源" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "查看银行库存" }));
  expect(screen.getByLabelText("银行剩余砖 19 张")).toBeTruthy();
  expect(document.querySelectorAll('[data-resource-source="bank"]')).toHaveLength(1);
  rerender(<BankSupplyButton resources={resourceAmounts({ brick: 7 })} />);
  expect(screen.getByLabelText("银行剩余砖 7 张")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "关闭" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.querySelectorAll('[data-resource-source="bank"]')).toHaveLength(1);
});

it("does not reveal stock in the compact dialog when the room hides bank counts", () => {
  render(<BankSupplyButton resources={null} />);
  fireEvent.click(screen.getByRole("button", { name: "查看银行库存" }));
  expect(document.querySelectorAll('[data-resource-card]')).toHaveLength(5);
  expect(document.querySelectorAll('[data-resource-count]')).toHaveLength(0);
  expect(screen.getByLabelText("银行木，数量不公开")).toBeTruthy();
});
