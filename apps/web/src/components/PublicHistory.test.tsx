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

it("shows all loaded entries oldest first and preserves existing row identities", () => {
  const { rerender } = render(<PublicHistory history={history(31)} />);
  const list = screen.getByRole("log");
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(31);
  expect(screen.getByText("31 条")).toBeDefined();
  expect(screen.queryByText(/向下更新/)).toBeNull();
  expect(rows[0]?.textContent).toBe("操作 1");
  expect(rows[30]?.textContent).toBe("操作 31");
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

it("does not jump on repeated snapshots and follows a new entry beyond thirty rows", () => {
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

it("loads earlier records without flagging historical prepends as new live messages", () => {
  const load = vi.fn();
  const { rerender } = render(<PublicHistory history={history(100).slice(50)} historyRange={{ afterRevision: 50, throughRevision: 100 }} onLoadEarlierHistory={load} />);
  fireEvent.click(screen.getByRole("button", { name: "加载较早记录" }));
  expect(load).toHaveBeenCalledOnce();
  rerender(<PublicHistory history={history(100)} historyRange={{ afterRevision: 0, throughRevision: 100 }} onLoadEarlierHistory={load} />);
  expect(screen.queryByRole("button", { name: "加载较早记录" })).toBeNull();
  expect(screen.queryByRole("button", { name: /有新记录/ })).toBeNull();
  expect(screen.getByRole("button", { name: "回到最新" })).toBeTruthy();
});
