import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog.js";

export function GameMenu({ children, tools }: { readonly children: ReactNode; readonly tools: ReactNode }) {
  return <Dialog>
    <DialogTrigger asChild>
      <Button type="button" size="sm" variant="ghost" aria-label="打开游戏菜单" data-resource-source="bank" className="h-9 gap-1 px-2 text-[#fff4d6] hover:bg-white/10 hover:text-white"><Menu className="size-4" />菜单</Button>
    </DialogTrigger>
    <DialogContent className="max-h-[80dvh] overflow-y-auto bg-[#fff3db] text-[#294b43] sm:max-w-sm">
      <DialogHeader><DialogTitle>游戏菜单</DialogTitle><DialogDescription>银行、记录与辅助工具。关闭后继续当前操作。</DialogDescription></DialogHeader>
      <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-11">{tools}</div>
      <div className="grid gap-2 border-t border-[#6d5434]/15 pt-3 [&>div]:flex [&>div]:min-h-11 [&>div]:items-center [&>div]:justify-between [&>div]:rounded-lg [&>div]:bg-[#173f42] [&>div]:px-3 [&>div]:text-[#fff4d6] [&_button]:min-h-11 [&_button]:min-w-11">{children}</div>
    </DialogContent>
  </Dialog>;
}
