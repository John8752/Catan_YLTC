import type { GameCommand, GameView } from "@catan/protocol";
import { ArrowRightLeft, Check, ChevronDown, CircleEllipsis, Handshake, MessageSquareReply, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.js";
import { cn } from "@/lib/utils.js";
import {
  hasTradeResources,
  TradeResourceBasket,
  TradeResourceSummary,
  type TradeBasket,
} from "./TradeResourceBasket.js";
import { TradeValidationNote, tradeProblem } from "./TradePresentation.js";

type OpenTrade = NonNullable<GameView["openTrade"]>;
type OfferResponse = OpenTrade["responses"][number];

const PLAYER_RING = {
  terracotta: "border-[#c85d42]/45 bg-[#c85d42]/10 text-[#8e3d2b]",
  ocean: "border-[#3886a5]/45 bg-[#3886a5]/10 text-[#245e77]",
  pine: "border-[#3f8057]/45 bg-[#3f8057]/10 text-[#285f3c]",
  wheat: "border-[#d2a534]/45 bg-[#d2a534]/10 text-[#805f13]",
  plum: "border-[#81577d]/45 bg-[#81577d]/10 text-[#60405d]",
  charcoal: "border-[#48504f]/45 bg-[#48504f]/10 text-[#333b3a]",
} as const;

export function ActiveTradePanel({ game, busy, onCommand }: {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}) {
  const offer = game.openTrade;
  const [expanded, setExpanded] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");

  useEffect(() => {
    if (offer !== null) setExpanded(true);
  }, [offer?.offerId]);

  useEffect(() => {
    if (offer === null || offer.proposerId !== game.you.id) return;
    const actionableIds = offer.responses
      .filter((response) => response.response !== "declined")
      .filter((response) => hasTradeResources(game.you.resources, responseTerms(offer, response).give))
      .map((response) => response.playerId);
    if (!actionableIds.includes(selectedPartnerId)) setSelectedPartnerId(actionableIds[0] ?? "");
  }, [game.you.id, game.you.resources, offer, selectedPartnerId]);

  if (offer === null) return null;
  const proposer = game.players.find((player) => player.id === offer.proposerId);
  const ownOffer = offer.proposerId === game.you.id;
  const ownResponse = offer.responses.find((response) => response.playerId === game.you.id);
  const selectedResponse = offer.responses.find((response) => response.playerId === selectedPartnerId);
  const selectedTerms = selectedResponse === undefined ? null : responseTerms(offer, selectedResponse);
  const selectedAffordable = selectedTerms !== null && hasTradeResources(game.you.resources, selectedTerms.give);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <section
        id="active-trade-panel"
        className="overflow-hidden rounded-2xl border border-[#8d5b3f]/20 bg-[#fff8e8]/96 shadow-[0_8px_20px_rgba(65,45,28,.24)] backdrop-blur-sm"
        aria-label={ownOffer ? "等待桌上回应" : "查看报价并回应"}
      >
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/35">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#214d48] text-[#fff8df]"><Handshake className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <small className="block text-[10px] font-black tracking-[.12em] text-[#99543d] uppercase">{ownOffer ? "你的公开报价" : `${proposer?.name ?? "玩家"} 的报价`}</small>
              <strong className="block truncate text-sm text-[#294b47]">{ownOffer ? "等待桌上回应" : "选择回应方式"}</strong>
            </span>
            <TradeResponseCount game={game} />
            <ChevronDown className={cn("size-4 shrink-0 text-[#526a63] transition-transform", expanded && "rotate-180")} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-[#6d5434]/12 px-3 py-3">
          <CompactTerms give={offer.give} receive={offer.receive} responderView={!ownOffer} />
          {ownOffer ? (
            <>
              <ProposerResponses game={game} offer={offer} busy={busy} selectedPartnerId={selectedPartnerId} onSelectedPartnerId={setSelectedPartnerId} />
              <div className="mt-3 grid gap-2">
                <Button
                  className="bg-[#214d48] text-[#fff8df] hover:bg-[#173d39]"
                  disabled={busy || selectedResponse === undefined || selectedResponse.response === "declined" || !selectedAffordable}
                  onClick={() => onCommand({ type: "CompleteTradeOffer", offerId: offer.offerId, partnerId: selectedPartnerId })}
                >
                  <Handshake className="size-4" />
                  {selectedResponse?.response === "countered" ? "接受所选反报价" : "与所选玩家成交"}
                </Button>
                <Button variant="ghost" size="sm" className="text-[#8f4e3a]" disabled={busy} onClick={() => onCommand({ type: "CancelTradeOffer", offerId: offer.offerId })}>
                  取消整份报价
                </Button>
              </div>
            </>
          ) : (
            <ResponderActions game={game} offer={offer} busy={busy} response={ownResponse} onCommand={onCommand} />
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function ProposerResponses({ game, offer, busy, selectedPartnerId, onSelectedPartnerId }: {
  readonly game: GameView;
  readonly offer: OpenTrade;
  readonly busy: boolean;
  readonly selectedPartnerId: string;
  readonly onSelectedPartnerId: (id: string) => void;
}) {
  return (
    <section className="mt-3 grid gap-2" aria-label="桌上回应">
      {game.players.filter((player) => player.id !== game.you.id).map((player) => {
        const response = offer.responses.find((candidate) => candidate.playerId === player.id);
        const terms = response === undefined ? null : responseTerms(offer, response);
        const selectable = response !== undefined && response.response !== "declined";
        const affordable = terms !== null && hasTradeResources(game.you.resources, terms.give);
        return (
          <button
            type="button"
            disabled={!selectable || !affordable || busy}
            aria-pressed={selectedPartnerId === player.id}
            aria-label={`${player.name}：${responseStatus(response)}`}
            className={cn(
              "grid gap-2 rounded-xl border-2 p-2.5 text-left transition",
              PLAYER_RING[player.color],
              selectable && affordable ? "hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default opacity-60",
              selectedPartnerId === player.id && "ring-2 ring-[#276a5b] ring-offset-1",
            )}
            key={player.id}
            onClick={() => selectable && affordable && onSelectedPartnerId(player.id)}
          >
            <span className="flex items-center gap-2">
              <PlayerResponseIcon response={response?.response} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{player.name}</strong><small className="font-bold">{responseStatus(response)}</small></span>
            </span>
            {response?.response === "countered" ? <CompactTerms give={response.proposerGives} receive={response.proposerReceives} /> : null}
            {selectable && !affordable ? <small className="font-bold text-rose-700">你的资源不足</small> : null}
          </button>
        );
      })}
    </section>
  );
}

function ResponderActions({ game, offer, busy, response, onCommand }: {
  readonly game: GameView;
  readonly offer: OpenTrade;
  readonly busy: boolean;
  readonly response: OfferResponse | undefined;
  readonly onCommand: (command: GameCommand) => void;
}) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [proposerGives, setProposerGives] = useState<TradeBasket>(() => response?.response === "countered" ? response.proposerGives : offer.give);
  const [proposerReceives, setProposerReceives] = useState<TradeBasket>(() => response?.response === "countered" ? response.proposerReceives : offer.receive);

  useEffect(() => {
    setCounterOpen(false);
    setProposerGives(response?.response === "countered" ? response.proposerGives : offer.give);
    setProposerReceives(response?.response === "countered" ? response.proposerReceives : offer.receive);
  }, [offer.offerId]);

  const canAccept = hasTradeResources(game.you.resources, offer.receive);
  const counterProblem = tradeProblem(proposerGives, proposerReceives, undefined, game.you.resources);

  return (
    <section className="mt-3 grid gap-3" aria-label="你的回应">
      <p className="m-0 text-center text-xs font-bold text-[#65706a]">{ownResponseMessage(response)}</p>
      <div className="grid grid-cols-3 gap-1.5">
        <Button variant="outline" size="sm" className={cn("h-auto flex-col gap-1 py-2 border-emerald-700/25", response?.response === "accepted" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800")} disabled={busy || !canAccept} onClick={() => { setCounterOpen(false); onCommand({ type: "AcceptTradeOffer", offerId: offer.offerId }); }}><Check className="size-4" />同意</Button>
        <Button variant="outline" size="sm" className={cn("h-auto flex-col gap-1 py-2 border-amber-700/25", response?.response === "countered" || counterOpen ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-800")} disabled={busy} onClick={() => setCounterOpen((current) => !current)}><MessageSquareReply className="size-4" />反报价</Button>
        <Button variant="outline" size="sm" className={cn("h-auto flex-col gap-1 py-2 border-rose-700/20", response?.response === "declined" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-800")} disabled={busy} onClick={() => { setCounterOpen(false); onCommand({ type: "DeclineTradeOffer", offerId: offer.offerId }); }}><X className="size-4" />拒绝</Button>
      </div>
      {!canAccept ? <p className="m-0 text-center text-xs font-bold text-rose-700">资源不足，不能同意原报价，但可以提出其他条件。</p> : null}
      {response?.response === "countered" && !counterOpen ? <CompactTerms give={response.proposerGives} receive={response.proposerReceives} responderView /> : null}

      {counterOpen ? (
        <form className="grid gap-3 rounded-xl border border-amber-800/15 bg-[#f4dfb8]/55 p-2.5" onSubmit={(event) => {
          event.preventDefault();
          setCounterOpen(false);
          onCommand({ type: "CounterTradeOffer", offerId: offer.offerId, proposerGives, proposerReceives });
        }}>
          <div><strong className="font-serif text-[#694723]">调整你的条件</strong><p className="m-0 text-[11px] text-[#766956]">点击上方资源增加，点击已选卡片撤回。</p></div>
          <section className="grid gap-1.5"><small className="font-black text-[#8e5d48]">你希望获得</small><TradeResourceBasket label="反报价中你希望获得" value={proposerGives} onChange={setProposerGives} /></section>
          <section className="grid gap-1.5"><small className="font-black text-[#35645d]">你愿意交出</small><TradeResourceBasket label="反报价中你愿意交出" value={proposerReceives} maximums={game.you.resources} onChange={setProposerReceives} /></section>
          <TradeValidationNote problem={counterProblem} fallback="提交不会立刻交换资源，由发起者决定。" />
          <Button type="submit" size="sm" className="bg-[#8a5b24] text-white hover:bg-[#71491d]" disabled={busy || counterProblem !== null}><Send className="size-4" />提交反报价</Button>
        </form>
      ) : null}
    </section>
  );
}

function CompactTerms({ give, receive, responderView = false }: { readonly give: TradeBasket; readonly receive: TradeBasket; readonly responderView?: boolean }) {
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 rounded-xl border border-[#6d5434]/10 bg-white/45 p-2 text-center">
      <span className="min-w-0"><small className="block text-[9px] font-black tracking-wide text-[#8e5d48] uppercase">{responderView ? "你获得" : "你给"}</small><TradeResourceSummary resources={give} /></span>
      <ArrowRightLeft className="size-3.5 text-[#9c573f]" aria-hidden="true" />
      <span className="min-w-0"><small className="block text-[9px] font-black tracking-wide text-[#35645d] uppercase">{responderView ? "你交出" : "你获得"}</small><TradeResourceSummary resources={receive} /></span>
    </span>
  );
}

function TradeResponseCount({ game }: { readonly game: GameView }) {
  const actionable = game.openTrade?.responses.filter((response) => response.response !== "declined").length ?? 0;
  const counters = game.openTrade?.responses.filter((response) => response.response === "countered").length ?? 0;
  if (actionable === 0) return null;
  return <Badge className="shrink-0 bg-[#2d6b58] px-1.5 text-[10px] text-white">{actionable}{counters > 0 ? ` · ↺${counters}` : ""}</Badge>;
}

function PlayerResponseIcon({ response }: { readonly response: OfferResponse["response"] | undefined }) {
  if (response === "accepted") return <span className="grid size-7 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-4" /></span>;
  if (response === "countered") return <span className="grid size-7 place-items-center rounded-full bg-amber-600 text-white"><MessageSquareReply className="size-4" /></span>;
  if (response === "declined") return <span className="grid size-7 place-items-center rounded-full bg-rose-600 text-white"><X className="size-4" /></span>;
  return <span className="grid size-7 place-items-center rounded-full bg-stone-400 text-white"><CircleEllipsis className="size-4" /></span>;
}

export function responseTerms(offer: OpenTrade, response: OfferResponse): { readonly give: TradeBasket; readonly receive: TradeBasket } {
  return response.response === "countered" ? { give: response.proposerGives, receive: response.proposerReceives } : { give: offer.give, receive: offer.receive };
}

function responseStatus(response: OfferResponse | undefined): string {
  if (response?.response === "accepted") return "同意交易";
  if (response?.response === "countered") return "提出反报价";
  if (response?.response === "declined") return "拒绝交易";
  return "等待回应";
}

function ownResponseMessage(response: OfferResponse | undefined): string {
  if (response?.response === "accepted") return "你已同意，等待发起者选择";
  if (response?.response === "countered") return "反报价已公开，可以继续修改";
  if (response?.response === "declined") return "你已拒绝，仍可修改回应";
  return "选择同意、拒绝或提出反报价。";
}
