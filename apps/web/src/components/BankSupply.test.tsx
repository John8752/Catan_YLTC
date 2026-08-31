// @vitest-environment jsdom
import { RESOURCE_TYPES, resourceAmounts } from "@catan/game-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BankSupply } from "./BankSupply.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";

afterEach(cleanup);

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
