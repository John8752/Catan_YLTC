import type { GameCommand, GameView } from "@catan/protocol";
import { ArrowRightLeft, ChevronUp, Handshake, Landmark, Send, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { randomId } from "@/lib/random-id.js";
import { cn } from "@/lib/utils.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";
import {
  emptyTradeBasket,
  type TradeBasket,
  TRADE_RESOURCES,
  TradeResourceBasket,
  type TradeResource,
} from "./TradeResourceBasket.js";
import { TradeExchange, TradeValidationNote, tradeProblem } from "./TradePresentation.js";

type Resource = TradeResource;

export interface TradeControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly allowPlayerTrades?: boolean;
  readonly playerGive?: TradeBasket | undefined;
  readonly onPlayerGiveChange?: ((value: TradeBasket) => void) | undefined;
  readonly composerOpen?: boolean | undefined;
  readonly onComposerOpenChange?: ((open: boolean) => void) | undefined;
  readonly handPickerExternal?: boolean;
}

export function TradeControls({
  game,
  busy,
  onCommand,
  allowPlayerTrades = true,
  playerGive: controlledPlayerGive,
  onPlayerGiveChange,
  composerOpen: controlledComposerOpen,
  onComposerOpenChange,
  handPickerExternal = false,
}: TradeControlsProps) {
  const [internalComposerOpen, setInternalComposerOpen] = useState(false);
  const [internalPlayerGive, setInternalPlayerGive] = useState(emptyTradeBasket);
  const [playerReceive, setPlayerReceive] = useState(emptyTradeBasket);
  const [give, setGive] = useState<Resource>("brick");
  const [receive, setReceive] = useState<Resource>("ore");
  const composerOpen = controlledComposerOpen ?? internalComposerOpen;
  const playerGive = controlledPlayerGive ?? internalPlayerGive;
  const setComposerOpen = (open: boolean) => {
    if (controlledComposerOpen === undefined) setInternalComposerOpen(open);
    onComposerOpenChange?.(open);
  };
  const setPlayerGive = (value: TradeBasket) => {
    if (controlledPlayerGive === undefined) setInternalPlayerGive(value);
    onPlayerGiveChange?.(value);
  };

  if (game.openTrade !== null) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full border-[#a65c43]/25 bg-[#fffaf0]/80 shadow-sm"
        onClick={() => document.getElementById("active-trade-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
      >
        <Handshake className="size-4" />查看交易桌
      </Button>
    );
  }

  if (game.interaction.kind !== "turn-action") return null;
  const playerOfferProblem = tradeProblem(playerGive, playerReceive, game.you.resources);
  const sameResource = give === receive;

  return (
    <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={composerOpen}
          className={cn(
            "w-full border-[#a65c43]/25 bg-[#fffaf0]/80 shadow-sm",
            composerOpen && "border-[#37685d]/45 bg-[#37685d] text-white hover:bg-[#315d53] hover:text-white",
          )}
        >
          {composerOpen ? <ChevronUp className="size-4" /> : <ArrowRightLeft className="size-4" />}
          {composerOpen ? "收起交易" : "发起交易"}
        </Button>
      </DialogTrigger>

      <DialogContent
        id="trade-composer-panel"
        className="trade-composer-sheet max-h-[70dvh] max-w-none gap-0 overflow-y-auto border-[#f7e6bf]/45 bg-[#f3e4c5]/98 p-3 text-[#263d39] shadow-2xl lg:max-h-[min(80dvh,44rem)] lg:max-w-3xl lg:rounded-2xl"
        showCloseButton={false}
      >
        <section className="grid gap-3" aria-label="交易编辑器">
          <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-[#6d5434]/15 pb-2 text-left">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-[#214d48] text-[#fff8df]"><Handshake className="size-4" /></span>
              <div>
                <DialogTitle className="font-serif text-lg">交易桌</DialogTitle>
                <DialogDescription className="text-xs text-[#6b716a]">组合资源后发布，棋盘仍可查看</DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="收起交易编辑器" onClick={() => setComposerOpen(false)}><X /></Button>
          </DialogHeader>

          <Tabs defaultValue={allowPlayerTrades ? "players" : "bank"}>
            <TabsList className={cn("grid h-10 w-full rounded-xl bg-[#dfcba4]/75 p-1", allowPlayerTrades ? "grid-cols-2" : "grid-cols-1")}>
              {allowPlayerTrades ? <TabsTrigger className="rounded-lg" value="players"><Handshake className="size-4" />玩家协商</TabsTrigger> : null}
              <TabsTrigger className="rounded-lg" value="bank"><Landmark className="size-4" />银行与港口</TabsTrigger>
            </TabsList>

            {allowPlayerTrades ? (
              <TabsContent value="players">
                <form className="mt-3 grid gap-3" onSubmit={(event) => {
                  event.preventDefault();
                  setComposerOpen(false);
                  onCommand({ type: "OpenTradeOffer", offerId: randomId(), give: playerGive, receive: playerReceive });
                  setPlayerGive(emptyTradeBasket());
                  setPlayerReceive(emptyTradeBasket());
                }}>
                  {handPickerExternal ? <p className="m-0 hidden rounded-lg bg-[#214d48]/8 px-3 py-2 text-center text-xs font-bold text-[#45625c] lg:block">点击下方“我的资源”加入我提供的卡片</p> : null}
                  <TradeExchange
                    giveLabel="我提供"
                    receiveLabel="我希望获得"
                    give={<TradeResourceBasket label="我提供" value={playerGive} maximums={game.you.resources} showPalette onChange={setPlayerGive} />}
                    receive={<TradeResourceBasket label="我希望获得" value={playerReceive} onChange={setPlayerReceive} />}
                  />
                  <TradeValidationNote problem={playerOfferProblem} fallback="可组合多种资源；点击已选卡片会撤回 1 张。" />
                  <Button className="sticky bottom-0 z-10 h-10 w-full bg-[#214d48] text-[#fff8df] shadow-[0_-8px_18px_rgba(243,228,197,.9)] hover:bg-[#173d39]" type="submit" disabled={busy || playerOfferProblem !== null}>
                    <Send className="size-4" />向所有玩家发布报价
                  </Button>
                </form>
              </TabsContent>
            ) : null}

            <TabsContent value="bank">
              <form className="mt-3 grid gap-3" onSubmit={(event) => {
                event.preventDefault();
                setComposerOpen(false);
                onCommand({ type: "MaritimeTrade", give, receive });
              }}>
                <TradeExchange
                  giveLabel={`交给银行 · ${game.you.maritimeRatios[give]} 张`}
                  receiveLabel="从银行获得 · 1 张"
                  give={<SingleResourcePicker label="交给银行" value={give} counts={game.you.resources} onChange={setGive} />}
                  receive={<SingleResourcePicker label="从银行获得" value={receive} onChange={setReceive} />}
                />
                <TradeValidationNote
                  problem={sameResource ? "交出与获得的资源不能相同" : game.you.resources[give] < game.you.maritimeRatios[give] ? `${resourceLabel(give)}数量不足` : null}
                  fallback={`当前兑换率 ${game.you.maritimeRatios[give]}:1，成交时由服务器再次检查银行库存。`}
                />
                <Button className="sticky bottom-0 z-10 h-10 w-full bg-[#214d48] text-[#fff8df] shadow-[0_-8px_18px_rgba(243,228,197,.9)] hover:bg-[#173d39]" type="submit" disabled={busy || sameResource || game.you.resources[give] < game.you.maritimeRatios[give]}>
                  <Landmark className="size-4" />确认银行交易
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function SingleResourcePicker({
  label,
  value,
  counts,
  onChange,
}: {
  readonly label: string;
  readonly value: Resource;
  readonly counts?: TradeBasket | undefined;
  readonly onChange: (resource: Resource) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={label}>
      {TRADE_RESOURCES.map((resource) => (
        <ResourceCard
          key={resource}
          resource={resource}
          variant="compact"
          count={counts?.[resource]}
          pressed={value === resource}
          ariaLabel={`${label}：${resourceLabel(resource)}`}
          onClick={() => onChange(resource)}
        />
      ))}
    </div>
  );
}
