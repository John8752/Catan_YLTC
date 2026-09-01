// @vitest-environment jsdom
import type { GameView } from "@catan/protocol";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PublicHistory } from "./PublicHistory.js";

const history = (count: number): GameView["history"] => Array.from({ length: count }, (_, index) => ({
  revision: index + 1, type: "dice_rolled", message: `操作 ${index + 1}`, privateDetail: null,
}));

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows the latest thirty entries oldest first and preserves existing row identities", () => {
  const { rerender } = render(<PublicHistory history={history(31)} />);
  const list = screen.getByRole("log");
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(30);
  expect(rows[0]?.textContent).toBe("操作 2");
  expect(rows[29]?.textContent).toBe("操作 31");
  const retained = screen.getByText("操作 3");
  rerender(<PublicHistory history={history(32)} />);
  expect(screen.getByText("操作 3")).toBe(retained);
  expect(within(list).getAllByRole("listitem").at(-1)?.textContent).toBe("操作 32");
});

it("follows new records at the bottom, pauses for reading and resumes explicitly", () => {
  const { container, rerender } = render(<PublicHistory history={history(20)} />);
  const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
  expect(viewport.scrollTop).toBe(1200);
  viewport.scrollTop = 1000;
  fireEvent.scroll(viewport);
  rerender(<PublicHistory history={history(21)} />);
  expect(viewport.scrollTop).toBe(1200);
  viewport.scrollTop = 200;
  fireEvent.scroll(viewport);
  rerender(<PublicHistory history={history(22)} />);
  expect(viewport.scrollTop).toBe(200);
  fireEvent.click(screen.getByRole("button", { name: /回到最新/ }));
  expect(viewport.scrollTop).toBe(1200);
});

it("does not jump on repeated snapshots and follows a new entry even at the thirty-row cap", () => {
  const { container, rerender } = render(<PublicHistory history={history(30)} />);
  const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
  viewport.scrollTop = 1000;
  fireEvent.scroll(viewport);
  rerender(<PublicHistory history={history(30)} />);
  expect(viewport.scrollTop).toBe(1000);
  rerender(<PublicHistory history={history(31)} />);
  expect(viewport.scrollTop).toBe(1200);
});

it("keeps following when layout shrinks before the resize observer, but preserves paused reading", () => {
  let height = 200;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => height);
  const { container } = render(<PublicHistory history={history(30)} />);
  const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
  viewport.scrollTop = 1000;
  fireEvent.scroll(viewport);
  height = 100;
  fireEvent.scroll(viewport);
  expect(viewport.scrollTop).toBe(1200);
  expect(screen.queryByRole("button", { name: /回到最新/ })).toBeNull();

  viewport.scrollTop = 200;
  fireEvent.scroll(viewport);
  height = 50;
  fireEvent.scroll(viewport);
  expect(viewport.scrollTop).toBe(200);
  expect(screen.getByRole("button", { name: /回到最新/ })).toBeDefined();
});
