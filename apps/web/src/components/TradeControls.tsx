import type { GameCommand, GameView } from "@catan/protocol";
import { ArrowRightLeft, Handshake, Landmark, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { randomId } from "@/lib/random-id.js";
import { cn } from "@/lib/utils.js";
import { OpenTradeDialog, responseTerms, TradeResponseCount } from "./OpenTradeDialog.js";
import {
  emptyTradeBasket,
  hasTradeResources,
  resourceLabel,
  resourceMark,
  TRADE_RESOURCES,
  TradeResourceBasket,
  type TradeResource,
} from "./TradeResourceBasket.js";
import { TradeDialogHeader, TradeExchange, TradeValidationNote, tradeProblem } from "./TradePresentation.js";

type Resource = TradeResource;

export interface TradeControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly allowPlayerTrades?: boolean;
}

export function TradeControls({ game, busy, onCommand, allowPlayerTrades = true }: TradeControlsProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [playerGive, setPlayerGive] = useState(emptyTradeBasket);
  const [playerReceive, setPlayerReceive] = useState(emptyTradeBasket);
  const [give, setGive] = useState<Resource>("brick");
  const [receive, setReceive] = useState<Resource>("ore");
  const offerId = game.openTrade?.offerId ?? null;

  useEffect(() => {
    if (offerId !== null) setOfferOpen(true);
  }, [offerId]);

  useEffect(() => {
    const offer = game.openTrade;
    const actionableIds = offer?.responses
      .filter((response) => response.response !== "declined")
      .filter((response) => hasTradeResources(game.you.resources, responseTerms(offer, response).give))
      .map((response) => response.playerId) ?? [];
    if (!actionableIds.includes(selectedPartnerId)) setSelectedPartnerId(actionableIds[0] ?? "");
  }, [game.openTrade, game.you.resources, selectedPartnerId]);

  if (game.openTrade !== null) {
    return (
      <>
        <Button variant="outline" size="sm" className="w-full border-[#a65c43]/25 bg-[#fffaf0]/80 shadow-sm" onClick={() => setOfferOpen(true)}>
          <Handshake className="size-4" />查看交易桌
          <TradeResponseCount game={game} />
        </Button>
        <OpenTradeDialog
          game={game}
          busy={busy}
          open={offerOpen}
          selectedPartnerId={selectedPartnerId}
          onOpenChange={setOfferOpen}
          onSelectedPartnerId={setSelectedPartnerId}
          onCommand={onCommand}
        />
      </>
    );
  }

  if (game.interaction.kind !== "turn-action") return null;
  const playerOfferProblem = tradeProblem(playerGive, playerReceive, game.you.resources);
  const sameResource = give === receive;

  return (
    <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full border-[#a65c43]/25 bg-[#fffaf0]/80 shadow-sm">
          <ArrowRightLeft className="size-4" />发起交易
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-[#f7e6bf]/35 bg-[#f5e7c9] p-0 text-[#263d39] shadow-2xl sm:max-w-3xl">
        <TradeDialogHeader
          icon={<Handshake className="size-6" />}
          eyebrow="行动阶段 · 交易"
          title="交易桌"
          description="向整桌玩家发布一个报价，或使用你当前最优惠的银行比例。"
        />

        <Tabs defaultValue={allowPlayerTrades ? "players" : "bank"} className="p-4 sm:p-6">
          <TabsList className={cn("grid h-11 w-full rounded-xl bg-[#dfcba4]/75 p-1", allowPlayerTrades ? "grid-cols-2" : "grid-cols-1")}>
            {allowPlayerTrades ? <TabsTrigger className="rounded-lg" value="players"><Handshake className="size-4" />玩家协商</TabsTrigger> : null}
            <TabsTrigger className="rounded-lg" value="bank"><Landmark className="size-4" />银行与港口</TabsTrigger>
          </TabsList>

          {allowPlayerTrades ? <TabsContent value="players">
            <form className="mt-5 grid gap-5" onSubmit={(event) => {
              event.preventDefault();
              setComposerOpen(false);
              onCommand({ type: "OpenTradeOffer", offerId: randomId(), give: playerGive, receive: playerReceive });
              setPlayerGive(emptyTradeBasket());
              setPlayerReceive(emptyTradeBasket());
            }}>
              <TradeExchange
                giveLabel="你放上桌面"
                receiveLabel="你希望拿走"
                give={<TradeResourceBasket label="你提供" value={playerGive} maximums={game.you.resources} onChange={setPlayerGive} />}
                receive={<TradeResourceBasket label="你希望获得" value={playerReceive} onChange={setPlayerReceive} />}
              />
              <TradeValidationNote problem={playerOfferProblem} fallback="可以组合多种资源，也可以将一侧留空。" />
              <Button className="h-11 w-full bg-[#214d48] text-[#fff8df] hover:bg-[#173d39]" type="submit" disabled={busy || playerOfferProblem !== null}>
                <Send className="size-4" />向所有玩家发布报价
              </Button>
            </form>
          </TabsContent> : null}

          <TabsContent value="bank">
            <form className="mt-5 grid gap-5" onSubmit={(event) => {
              event.preventDefault();
              setComposerOpen(false);
              onCommand({ type: "MaritimeTrade", give, receive });
            }}>
              <div className="rounded-2xl border border-[#6d5434]/12 bg-[#fffaf0]/60 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="mb-1 text-xs font-black tracking-[.14em] text-[#8f6749] uppercase">当前最优兑换率</p>
                    <strong className="font-serif text-2xl text-[#244c48]">{game.you.maritimeRatios[give]} : 1</strong>
                  </div>
                  <span className="grid size-12 place-items-center rounded-full border border-[#b89358]/30 bg-[#e7d09f] text-xl shadow-inner" aria-hidden="true">⚓</span>
                </div>
                <TradeExchange
                  giveLabel={`交给银行 · ${game.you.maritimeRatios[give]} 张`}
                  receiveLabel="从银行获得 · 1 张"
                  give={<ResourcePicker resource={give} onResource={setGive} />}
                  receive={<ResourcePicker resource={receive} onResource={setReceive} />}
                />
              </div>
              <TradeValidationNote
                problem={sameResource ? "交出与获得的资源不能相同" : game.you.resources[give] < game.you.maritimeRatios[give] ? `${resourceLabel(give)}数量不足` : null}
                fallback="港口优惠已自动计入，成交时仍由服务器检查银行库存。"
              />
              <Button className="h-11 w-full bg-[#214d48] text-[#fff8df] hover:bg-[#173d39]" type="submit" disabled={busy || sameResource || game.you.resources[give] < game.you.maritimeRatios[give]}>
                <Landmark className="size-4" />确认银行交易
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ResourcePicker({ resource, onResource }: { readonly resource: Resource; readonly onResource: (resource: Resource) => void }) {
  return (
    <select className="h-12 w-full rounded-xl border border-input bg-white/85 px-3 font-black text-[#304a46] outline-none focus:ring-2 focus:ring-ring" value={resource} onChange={(event) => onResource(event.target.value as Resource)}>
      {TRADE_RESOURCES.map((candidate) => <option key={candidate} value={candidate}>{resourceMark(candidate)} {resourceLabel(candidate)}</option>)}
    </select>
  );
}
