import type { GameCommand, GameView } from "@catan/protocol";
import { ArrowRightLeft, Check, CircleEllipsis, Handshake, MessageSquareReply, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog.js";
import { Separator } from "@/components/ui/separator.js";
import { cn } from "@/lib/utils.js";
import {
  hasTradeResources,
  TradeResourceBasket,
  TradeResourceSummary,
  type TradeBasket,
} from "./TradeResourceBasket.js";
import { TradeDialogHeader, TradeExchange, TradeValidationNote, tradeProblem } from "./TradePresentation.js";

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

export function OpenTradeDialog({
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
  const ownResponse = offer.responses.find((response) => response.playerId === game.you.id);
  const selectedResponse = offer.responses.find((response) => response.playerId === selectedPartnerId);
  const selectedTerms = selectedResponse === undefined ? null : responseTerms(offer, selectedResponse);
  const selectedAffordable = selectedTerms !== null && hasTradeResources(game.you.resources, selectedTerms.give);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-[#f7e6bf]/35 bg-[#f5e7c9] p-0 text-[#263d39] shadow-2xl sm:max-w-3xl" showCloseButton={false}>
        <TradeDialogHeader
          icon={<Handshake className="size-6" />}
          eyebrow={ownOffer ? "你的公开报价" : `${proposer?.name ?? "玩家"} 发起的交易`}
          title={ownOffer ? "等待桌上回应" : "查看报价并回应"}
          description={ownOffer ? "同意与反报价都不会自动成交，由你做最后选择。" : "你可以接受、拒绝，或给出一份可修改的反报价。"}
          onClose={() => onOpenChange(false)}
        />

        <div className="grid gap-5 p-4 sm:p-6">
          <section className="rounded-2xl border border-[#6d5434]/12 bg-[#fffaf0]/55 p-4 shadow-[inset_0_1px_rgba(255,255,255,.65)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-black tracking-[.14em] text-[#8f6749] uppercase">原始报价</p>
                <strong className="font-serif text-lg text-[#294b47]">{proposer?.name ?? "玩家"} 放上交易桌</strong>
              </div>
              <Badge variant="outline" className="border-[#a65c43]/25 bg-[#f1dcc0] text-[#7e4c38]">全桌可见</Badge>
            </div>
            <TradeExchange
              giveLabel={ownOffer ? "你提供" : "你将获得"}
              receiveLabel={ownOffer ? "你希望获得" : "你需要交出"}
              give={<TradeResourceSummary resources={offer.give} />}
              receive={<TradeResourceSummary resources={offer.receive} />}
            />
          </section>

          <Separator className="bg-[#6d5434]/15" />
          {ownOffer ? (
            <ProposerResponses game={game} offer={offer} busy={busy} selectedPartnerId={selectedPartnerId} onSelectedPartnerId={onSelectedPartnerId} />
          ) : (
            <ResponderActions game={game} offer={offer} busy={busy} response={ownResponse} onCommand={onCommand} />
          )}

          {ownOffer ? (
            <DialogFooter className="grid grid-cols-1 gap-2 border-t border-[#6d5434]/12 pt-4 sm:grid-cols-[auto_1fr]">
              <Button variant="outline" className="h-11 border-[#8a5e48]/25 bg-white/45" disabled={busy} onClick={() => onCommand({ type: "CancelTradeOffer", offerId: offer.offerId })}>
                取消整份报价
              </Button>
              <Button
                className="h-11 bg-[#214d48] text-[#fff8df] hover:bg-[#173d39]"
                disabled={busy || selectedResponse === undefined || selectedResponse.response === "declined" || !selectedAffordable}
                onClick={() => onCommand({ type: "CompleteTradeOffer", offerId: offer.offerId, partnerId: selectedPartnerId })}
              >
                <Handshake className="size-4" />
                {selectedResponse?.response === "countered" ? "接受所选反报价并成交" : "按原报价与所选玩家成交"}
              </Button>
            </DialogFooter>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
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
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-black tracking-[.14em] text-[#68736d] uppercase">桌上回应</p>
          <p className="m-0 text-sm text-[#65706a]">选择绿色同意或琥珀色反报价作为成交对象。</p>
        </div>
        <TradeResponseCount game={game} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
              className={cn(
                "grid min-h-28 gap-3 rounded-2xl border-2 p-3 text-left transition sm:p-4",
                PLAYER_RING[player.color],
                selectable && affordable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default opacity-70",
                selectedPartnerId === player.id ? "ring-2 ring-[#276a5b] ring-offset-2 ring-offset-[#f5e7c9]" : "",
              )}
              key={player.id}
              onClick={() => selectable && affordable && onSelectedPartnerId(player.id)}
            >
              <span className="flex items-center gap-3">
                <PlayerResponseIcon response={response?.response} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-base">{player.name}</strong>
                  <small className="font-bold">{responseStatus(response)}</small>
                </span>
              </span>
              {response?.response === "countered" ? <CompactTerms give={response.proposerGives} receive={response.proposerReceives} /> : null}
              {selectable && !affordable ? <small className="font-bold text-rose-700">你的资源不足，暂时无法选择</small> : null}
            </button>
          );
        })}
      </div>
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
    <section className="grid gap-4 rounded-2xl border border-[#6d5434]/12 bg-white/30 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-black tracking-[.14em] text-[#68736d] uppercase">你的回应</p>
          <p className="m-0 text-sm text-[#65706a]">{ownResponseMessage(response)}</p>
        </div>
        {response?.response === "countered" ? <Badge className="w-fit bg-[#a9702e] text-white">反报价已公开</Badge> : null}
      </div>
      {response?.response === "countered" && !counterOpen ? <CompactTerms give={response.proposerGives} receive={response.proposerReceives} responderView /> : null}

      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
        <Button variant="outline" className={cn("h-11 border-emerald-700/25", response?.response === "accepted" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-emerald-50 text-emerald-800")} disabled={busy || !canAccept} onClick={() => { setCounterOpen(false); onCommand({ type: "AcceptTradeOffer", offerId: offer.offerId }); }}>
          <Check className="size-5" />同意原报价
        </Button>
        <Button variant="outline" className={cn("h-11 border-amber-700/25", response?.response === "countered" || counterOpen ? "bg-amber-700 text-white hover:bg-amber-800" : "bg-amber-50 text-amber-800")} disabled={busy} onClick={() => setCounterOpen((current) => !current)}>
          <MessageSquareReply className="size-5" />{response?.response === "countered" ? "修改反报价" : "提出反报价"}
        </Button>
        <Button variant="outline" className={cn("h-11 border-rose-700/20", response?.response === "declined" ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-rose-50 text-rose-800")} disabled={busy} onClick={() => { setCounterOpen(false); onCommand({ type: "DeclineTradeOffer", offerId: offer.offerId }); }}>
          <X className="size-5" />拒绝
        </Button>
      </div>
      {!canAccept ? <p className="m-0 text-center text-xs font-bold text-rose-700">你的资源不足，无法同意原报价，但仍可提出其他条件。</p> : null}

      {counterOpen ? (
        <form className="grid gap-4 rounded-2xl border border-amber-800/15 bg-[#f4dfb8]/55 p-3 sm:p-4" onSubmit={(event) => {
          event.preventDefault();
          setCounterOpen(false);
          onCommand({ type: "CounterTradeOffer", offerId: offer.offerId, proposerGives, proposerReceives });
        }}>
          <div>
            <p className="mb-1 font-serif text-lg font-bold text-[#694723]">调整你的条件</p>
            <p className="m-0 text-xs leading-relaxed text-[#766956]">这份条件会替换你之前的回应，并公开给桌上所有玩家。</p>
          </div>
          <TradeExchange
            giveLabel="你希望获得"
            receiveLabel="你愿意交出"
            give={<TradeResourceBasket label="反报价中你希望获得" value={proposerGives} onChange={setProposerGives} />}
            receive={<TradeResourceBasket label="反报价中你愿意交出" value={proposerReceives} maximums={game.you.resources} onChange={setProposerReceives} />}
          />
          <TradeValidationNote problem={counterProblem} fallback="发起者会决定是否接受；提交不会立刻交换资源。" />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="bg-white/45" onClick={() => setCounterOpen(false)}>收起</Button>
            <Button type="submit" className="bg-[#8a5b24] text-white hover:bg-[#71491d]" disabled={busy || counterProblem !== null}><Send className="size-4" />提交反报价</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function CompactTerms({ give, receive, responderView = false }: { readonly give: TradeBasket; readonly receive: TradeBasket; readonly responderView?: boolean }) {
  return (
    <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-[#6d5434]/10 bg-white/45 p-2 text-center">
      <span><small className="block text-[10px] font-black tracking-wide text-[#8e5d48] uppercase">{responderView ? "你获得" : "你给"}</small><TradeResourceSummary resources={give} /></span>
      <ArrowRightLeft className="size-4 text-[#9c573f]" aria-hidden="true" />
      <span><small className="block text-[10px] font-black tracking-wide text-[#35645d] uppercase">{responderView ? "你交出" : "你获得"}</small><TradeResourceSummary resources={receive} /></span>
    </span>
  );
}

export function TradeResponseCount({ game }: { readonly game: GameView }) {
  const actionable = game.openTrade?.responses.filter((response) => response.response !== "declined").length ?? 0;
  const counters = game.openTrade?.responses.filter((response) => response.response === "countered").length ?? 0;
  if (actionable === 0) return null;
  return <Badge className="ml-auto bg-[#2d6b58] text-white">{actionable} 个可选{counters > 0 ? ` · ${counters} 个反报价` : ""}</Badge>;
}

function PlayerResponseIcon({ response }: { readonly response: OfferResponse["response"] | undefined }) {
  if (response === "accepted") return <span className="grid size-10 place-items-center rounded-full bg-emerald-600 text-white shadow-sm"><Check className="size-5" /></span>;
  if (response === "countered") return <span className="grid size-10 place-items-center rounded-full bg-amber-600 text-white shadow-sm"><MessageSquareReply className="size-5" /></span>;
  if (response === "declined") return <span className="grid size-10 place-items-center rounded-full bg-rose-600 text-white shadow-sm"><X className="size-5" /></span>;
  return <span className="grid size-10 place-items-center rounded-full bg-stone-400 text-white shadow-sm"><CircleEllipsis className="size-5" /></span>;
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
  if (response?.response === "countered") return "你已提交反报价，可以继续修改或改为同意";
  if (response?.response === "declined") return "你已拒绝，可以改为同意";
  return "选择一个回应；任何回应在成交前都可以修改。";
}
