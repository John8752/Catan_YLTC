import type { ResourceHand } from "@catan/game-core";
import { Landmark } from "lucide-react";
import { Button } from "./ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.js";
import { BankSupply } from "./BankSupply.js";

export function BankSupplyButton({ resources }: { readonly resources: ResourceHand | null }) {
  return <Dialog>
    <DialogTrigger asChild>
      <Button type="button" size="sm" variant="secondary" aria-label="查看银行库存" data-resource-source="bank">
        <Landmark aria-hidden="true" />银行
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-[min(24rem,calc(100%-1rem))] bg-[#f8ecd2] p-4 text-[#263d39]">
      <DialogHeader>
        <DialogTitle>银行库存</DialogTitle>
        <DialogDescription>{resources === null ? "本房间不公开剩余数量；兑换仍由服务器检查库存。" : "查看当前剩余资源，库存随对局实时更新。"}</DialogDescription>
      </DialogHeader>
      <BankSupply resources={resources} effectAnchor={false} className="mr-0 justify-center" />
    </DialogContent>
  </Dialog>;
}
