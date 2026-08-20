import type { GameCommand, GameView } from "@catan/protocol";
import { ArrowDown, ArrowRightLeft, Check, CircleEllipsis, Handshake, Landmark, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card } from "@/components/ui/card.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { Separator } from "@/components/ui/separator.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { cn } from "@/lib/utils.js";
import {
  emptyTradeBasket,
  hasTradeResources,
  overlappingTradeResources,
  resourceLabel,
  resourceMark,
  TRADE_RESOURCES,
  TradeResourceBasket,
  TradeResourceSummary,
  tradeBasketTotal,
  type TradeResource,
} from "./TradeResourceBasket.js";

type Resource = TradeResource;

const PLAYER_RING = {
  terracotta: "border-[#c85d42] bg-[#c85d42]/15 text-[#8e3d2b]",
  ocean: "border-[#3886a5] bg-[#3886a5]/15 text-[#245e77]",
  pine: "border-[#3f8057] bg-[#3f8057]/15 text-[#285f3c]",
  wheat: "border-[#d2a534] bg-[#d2a534]/15 text-[#805f13]",
  plum: "border-[#81577d] bg-[#81577d]/15 text-[#60405d]",
  charcoal: "border-[#48504f] bg-[#48504f]/15 text-[#333b3a]",
} as const;

export interface TradeControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function TradeControls({ game, busy, onCommand }: TradeControlsProps) {
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
    const acceptedIds = game.openTrade?.responses
      .filter((response) => response.response === "accepted")
      .map((response) => response.playerId) ?? [];
    if (!acceptedIds.includes(selectedPartnerId)) setSelectedPartnerId(acceptedIds[0] ?? "");
  }, [game.openTrade, selectedPartnerId]);

  if (game.openTrade !== null) {
    return (
      <>
        <Button variant="outline" size="sm" className="w-full border-[#a65c43]/25 bg-[#fffaf0]/70" onClick={() => setOfferOpen(true)}>
          <Handshake className="size-4" />查看交易报价
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
  const sameResource = give === receive;
  const overlappingResources = overlappingTradeResources(playerGive, playerReceive);
  const playerOfferProblem = tradeBasketTotal(playerGive) === 0 && tradeBasketTotal(playerReceive) === 0
    ? "报价双方不能同时为空"
    : overlappingResources.length > 0
      ? `同一种资源不能同时出现在两侧：${overlappingResources.map(resourceLabel).join("、")}`
      : !hasTradeResources(game.you.resources, playerGive)
        ? "你提供的资源超过了当前持有数量"
        : null;

  return (
    <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full border-[#a65c43]/25 bg-[#fffaf0]/70">
          <ArrowRightLeft className="size-4" />发起交易
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#f7e6bf]/30 bg-[#f8ecd2] text-[#263d39] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl"><Handshake className="size-6 text-[#b45c42]" />交易所</DialogTitle>
          <DialogDescription>选择向其他玩家报价，或按你当前的港口比例与银行交易。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="players" className="mt-2">
          <TabsList className="grid w-full grid-cols-2 bg-[#e4d3b2]">
            <TabsTrigger value="players"><Handshake className="size-4" />玩家交易</TabsTrigger>
            <TabsTrigger value="bank"><Landmark className="size-4" />银行与港口</TabsTrigger>
          </TabsList>
          <TabsContent value="players">
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setComposerOpen(false);
                onCommand({
                  type: "OpenTradeOffer",
                  offerId: crypto.randomUUID(),
                  give: playerGive,
                  receive: playerReceive,
                });
                setPlayerGive(emptyTradeBasket());
                setPlayerReceive(emptyTradeBasket());
              }}
            >
              <TradeExchange
                giveLabel="你提供"
                receiveLabel="你希望获得"
                give={<TradeResourceBasket label="你提供" value={playerGive} maximums={game.you.resources} onChange={setPlayerGive} />}
                receive={<TradeResourceBasket label="你希望获得" value={playerReceive} onChange={setPlayerReceive} />}
              />
              <p className={cn("text-center text-xs", playerOfferProblem === null ? "text-[#68736d]" : "font-bold text-rose-700")}>
                {playerOfferProblem ?? "任意一侧可以留空；五种资源可以自由组合。"}
              </p>
              <Button className="w-full" type="submit" disabled={busy || playerOfferProblem !== null}>
                向所有玩家发布报价
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="bank">
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setComposerOpen(false);
                onCommand({ type: "MaritimeTrade", give, receive });
              }}
            >
              <TradeExchange
                giveLabel={`你交给银行（${game.you.maritimeRatios[give]} 张）`}
                receiveLabel="银行给你（1 张）"
                give={<ResourcePicker resource={give} onResource={setGive} />}
                receive={<ResourcePicker resource={receive} onResource={setReceive} />}
              />
              <p className="text-center text-sm text-[#68736d]">当前比例：{game.you.maritimeRatios[give]} 个{resourceLabel(give)}换 1 个{resourceLabel(receive)}</p>
              <Button className="w-full" type="submit" disabled={busy || sameResource || game.you.resources[give] < game.you.maritimeRatios[give]}>
                确认银行交易
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OpenTradeDialog({
  game,
  busy,
  open,
  selectedPartnerId,
  onOpenChange,
  onSelectedPartnerId,
  onCommand,
}: {
  readonly game: GameView;
  readonly busy: boolean;
  readonly open: boolean;
  readonly selectedPartnerId: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelectedPartnerId: (id: string) => void;
  readonly onCommand: (command: GameCommand) => void;
}) {
  const offer = game.openTrade;
  if (offer === null) return null;
  const proposer = game.players.find((player) => player.id === offer.proposerId);
  const ownOffer = offer.proposerId === game.you.id;
  const ownResponse = offer.responses.find((response) => response.playerId === game.you.id)?.response;
  const canAccept = hasTradeResources(game.you.resources, offer.receive);
  const selectedAccepted = offer.responses.some((response) => response.playerId === selectedPartnerId && response.response === "accepted");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#f7e6bf]/30 bg-[#f8ecd2] text-[#263d39] sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 font-serif text-2xl"><Handshake className="size-6 text-[#b45c42]" />{ownOffer ? "等待玩家回应" : `${proposer?.name ?? "玩家"} 的交易报价`}</DialogTitle>
              <DialogDescription className="mt-1">同意不会立即成交；报价发起者会在所有回应中选择一位玩家。</DialogDescription>
            </div>
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="暂时关闭交易弹窗"><X className="size-5" /></Button></DialogClose>
          </div>
        </DialogHeader>

        <TradeExchange
          giveLabel={ownOffer ? "你提供" : "你将获得"}
          receiveLabel={ownOffer ? "你希望获得" : "你需要交出"}
          give={<TradeResourceSummary resources={offer.give} />}
          receive={<TradeResourceSummary resources={offer.receive} />}
        />

        <Separator className="bg-[#6d5434]/15" />

        {ownOffer ? (
          <section>
            <p className="mb-3 text-xs font-black tracking-[.12em] text-[#68736d] uppercase">玩家回应 · 点击绿色勾选成交对象</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {game.players.filter((player) => player.id !== game.you.id).map((player) => {
                const response = offer.responses.find((candidate) => candidate.playerId === player.id)?.response;
                const accepted = response === "accepted";
                return (
                  <button
                    type="button"
                    disabled={!accepted || busy}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition",
                      PLAYER_RING[player.color],
                      accepted ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default opacity-70",
                      selectedPartnerId === player.id ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-[#f8ecd2]" : "",
                    )}
                    key={player.id}
                    onClick={() => accepted && onSelectedPartnerId(player.id)}
                  >
                    <PlayerResponseIcon response={response} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{player.name}</strong>
                      <small>{response === "accepted" ? "同意交易" : response === "declined" ? "拒绝交易" : "等待回应"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-[#6d5434]/15 bg-white/35 p-4">
            <p className="mb-3 text-center text-sm text-[#65706a]">
              {ownResponse === "accepted" ? "你已同意，等待发起者选择" : ownResponse === "declined" ? "你已拒绝，可以改为同意" : "请选择你的回应"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className={cn("border-emerald-700/30", ownResponse === "accepted" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-emerald-50 text-emerald-800")}
                disabled={busy || !canAccept}
                onClick={() => onCommand({ type: "AcceptTradeOffer", offerId: offer.offerId })}
              >
                <Check className="size-5" />同意
              </Button>
              <Button
                variant="outline"
                className={cn("border-rose-700/25", ownResponse === "declined" ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-rose-50 text-rose-800")}
                disabled={busy}
                onClick={() => onCommand({ type: "DeclineTradeOffer", offerId: offer.offerId })}
              >
                <X className="size-5" />拒绝
              </Button>
            </div>
            {!canAccept ? <p className="mt-2 mb-0 text-center text-xs font-bold text-rose-700">你的资源不足，无法同意这份报价</p> : null}
          </section>
        )}

        {ownOffer ? (
          <DialogFooter className="grid grid-cols-2 sm:grid-cols-2">
            <Button variant="outline" disabled={busy} onClick={() => onCommand({ type: "CancelTradeOffer", offerId: offer.offerId })}>取消报价</Button>
            <Button
              disabled={busy || !selectedAccepted}
              onClick={() => onCommand({ type: "CompleteTradeOffer", offerId: offer.offerId, partnerId: selectedPartnerId })}
            >
              <Handshake className="size-4" />与所选玩家成交
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TradeExchange({ giveLabel, receiveLabel, give, receive }: { readonly giveLabel: string; readonly receiveLabel: string; readonly give: React.ReactNode; readonly receive: React.ReactNode }) {
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <Card className="gap-2 border-[#6d5434]/15 bg-white/45 p-4 text-center shadow-none"><small className="font-bold text-[#7a7062]">{giveLabel}</small>{give}</Card>
      <ArrowDown className="mx-auto size-6 text-[#b45c42] sm:rotate-[-90deg]" aria-hidden="true" />
      <Card className="gap-2 border-[#6d5434]/15 bg-white/45 p-4 text-center shadow-none"><small className="font-bold text-[#7a7062]">{receiveLabel}</small>{receive}</Card>
    </div>
  );
}

function TradeResponseCount({ game }: { readonly game: GameView }) {
  const accepted = game.openTrade?.responses.filter((response) => response.response === "accepted").length ?? 0;
  return accepted === 0 ? null : <Badge className="ml-auto bg-emerald-700">{accepted} 个同意</Badge>;
}

function PlayerResponseIcon({ response }: { readonly response: "accepted" | "declined" | undefined }) {
  if (response === "accepted") return <span className="grid size-9 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-5" /></span>;
  if (response === "declined") return <span className="grid size-9 place-items-center rounded-full bg-rose-600 text-white"><X className="size-5" /></span>;
  return <span className="grid size-9 place-items-center rounded-full bg-stone-400 text-white"><CircleEllipsis className="size-5" /></span>;
}

function ResourcePicker({ resource, onResource }: { readonly resource: Resource; readonly onResource: (resource: Resource) => void }) {
  return (
    <select className="w-full rounded-md border border-input bg-white/70 px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-ring" value={resource} onChange={(event) => onResource(event.target.value as Resource)}>
      {TRADE_RESOURCES.map((candidate) => <option key={candidate} value={candidate}>{resourceMark(candidate)} {resourceLabel(candidate)}</option>)}
    </select>
  );
}
