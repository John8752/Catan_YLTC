// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "./Welcome.js";

afterEach(() => cleanup());

describe("welcome story", () => {
  it("creates the camel race from the new game choice", () => {
    const create = vi.fn(); render(<Welcome busy={false} error={null} onCreate={create} onJoin={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "领航员" } });
    fireEvent.click(screen.getByRole("radio", { name: /骆驼大赛/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建骆驼大赛房间" }));
    expect(create).toHaveBeenCalledWith("领航员", "camel-up");
  });
  it("submits the selected game at creation without affecting join", () => {
    const create = vi.fn(), join = vi.fn(); render(<Welcome busy={false} error={null} onCreate={create} onJoin={join} />);
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "朋友" } });
    fireEvent.click(screen.getByRole("radio", { name: /传画猜词/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建传画猜词房间" }));
    expect(create).toHaveBeenCalledWith("朋友", "draw-guess"); expect(join).not.toHaveBeenCalled();
  });
  it("welcomes the six-player group with a short legend for every member", () => {
    render(<Welcome busy={false} error={null} onCreate={vi.fn()} onJoin={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "朋友在语音里，快乐在桌面上。" })).toBeTruthy();
    const legends = screen.getByLabelText("今晚的六位开拓者");
    for (const name of ["wjw", "zxc", "zzx", "qyp", "zj", "yst"]) {
      expect(legends.textContent).toContain(name);
    }
    expect(screen.getByRole("button", { name: "创建今晚的岛" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "登岛" })).toBeTruthy();
  });
  it("creates the independent Carcassonne room from the catalog",()=>{
    const create=vi.fn();render(<Welcome busy={false} error={null} onCreate={create} onJoin={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText("显示名称"),{target:{value:"拼城朋友"}});
    fireEvent.click(screen.getByRole("radio",{name:/卡卡颂/}));
    fireEvent.click(screen.getByRole("button",{name:"创建卡卡颂房间"}));
    expect(create).toHaveBeenCalledWith("拼城朋友","carcassonne");
  });
});
