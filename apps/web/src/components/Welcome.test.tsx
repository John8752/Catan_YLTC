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
  it("offers all games and joins a room independently of the selected game", () => {
    const join = vi.fn();
    render(<Welcome busy={false} error={null} onCreate={vi.fn()} onJoin={join} />);

    expect(screen.getByRole("heading", { name: "今晚，开哪一桌？" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "朋友" } });
    fireEvent.click(screen.getByRole("radio", { name: "德州扑克" }));
    fireEvent.change(screen.getByLabelText("六位房间码"), { target: { value: "abc123" } });
    fireEvent.click(screen.getByRole("button", { name: "加入房间" }));
    expect(join).toHaveBeenCalledWith("ABC123", "朋友");
  });
  it("creates the independent Carcassonne room from the catalog",()=>{
    const create=vi.fn();render(<Welcome busy={false} error={null} onCreate={create} onJoin={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText("显示名称"),{target:{value:"拼城朋友"}});
    fireEvent.click(screen.getByRole("radio",{name:/卡卡颂/}));
    fireEvent.click(screen.getByRole("button",{name:"创建卡卡颂房间"}));
    expect(create).toHaveBeenCalledWith("拼城朋友","carcassonne");
  });
});
