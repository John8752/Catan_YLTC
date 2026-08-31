// @vitest-environment jsdom
import { RESOURCE_TYPES, resourceAmounts } from "@catan/game-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BankSupply } from "./BankSupply.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";

afterEach(cleanup);

it("keeps resource icons but exposes no stock when bank counts are hidden", () => {
  const { container } = render(<BankSupply resources={null} />);
  expect(container.querySelector('[data-resource-source="bank"]')).not.toBeNull();
  expect(container.querySelectorAll('[data-resource-card]')).toHaveLength(5);
  expect(container.querySelector('[data-resource-count]')).toBeNull();
  for (const resource of RESOURCE_TYPES) {
    const card = screen.getByLabelText(`银行${resourceLabel(resource)}，数量不公开`);
    expect(card.textContent).toBe("");
    expect(card.getAttribute("title")).toContain("数量不公开");
  }
});

it.each([19, 24])("shows icon-only bank cards with accessible names and %i-stock counts", (stock) => {
  const resources = resourceAmounts({ brick: 0, lumber: stock, wool: stock, grain: stock, ore: stock });
  const { container } = render(<BankSupply resources={resources} />);
  expect(container.querySelectorAll('[data-resource-source="bank"]')).toHaveLength(1);
  for (const resource of RESOURCE_TYPES) {
    const label = `银行剩余${resourceLabel(resource)} ${resources[resource]} 张`;
    const card = screen.getByLabelText(label);
    expect(card.getAttribute("title")).toBe(label);
    expect(card.textContent).toBe(String(resources[resource]));
    expect(card.querySelector(`[data-resource-icon="${resource}"]`)).not.toBeNull();
    expect(card.querySelector("[data-resource-count]")?.textContent).toBe(String(resources[resource]));
  }
});

it("leaves hand and trade-picker labels unchanged", () => {
  render(<><ResourceCard resource="brick" count={3} /><ResourceCard resource="wool" variant="compact" /></>);
  expect(screen.getByText("砖")).not.toBeNull();
  expect(screen.getByText("羊")).not.toBeNull();
});
