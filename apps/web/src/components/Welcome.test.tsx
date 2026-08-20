// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "./Welcome.js";

afterEach(() => cleanup());

describe("welcome story", () => {
  it("welcomes the six-player group with a short legend for every member", () => {
    render(<Welcome busy={false} error={null} onCreate={vi.fn()} onJoin={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "六个人，一座不肯安静的岛。" })).toBeTruthy();
    const legends = screen.getByLabelText("今晚的六位开拓者");
    for (const name of ["wjw", "zxc", "zzx", "qyp", "zj", "yst"]) {
      expect(legends.textContent).toContain(name);
    }
    expect(screen.getByRole("button", { name: "创建今晚的岛" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "登岛" })).toBeTruthy();
  });
});
