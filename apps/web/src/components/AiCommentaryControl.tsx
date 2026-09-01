import {
  AI_COMMENTARY_MODES,
  type AiCommentaryMode,
  type PublicSetupAnalysisView,
  type RoomView,
  type TableIntentContent,
} from "@catan/protocol";
import { BrainCircuit, Crosshair, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { requestAiCommentary, type PlayerSession } from "@/api.js";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { PlayerColorDot } from "./PlayerColorDot.js";

const MODE_LABELS: Readonly<Record<AiCommentaryMode, string>> = {
  commentary: "吐槽一下",
  summary: "总结局势",
  prediction: "预测走势",
  intent: "大家在惦记什么",
};
const MODES = AI_COMMENTARY_MODES.map((mode) => ({ mode, label: MODE_LABELS[mode] }));

type CommentaryView = "setup" | "log";

interface CommentaryLogEntry {
  readonly id: number;
  readonly mode: AiCommentaryMode;
  readonly revision: number;
  readonly content: string;
  /** Only "intent" carries one; every other mode answers in prose. */
  readonly intent: TableIntentContent | null;
}

export function AiCommentaryControl({ session, revision, turnNumber, setupAnalysis, players, onFocusVertex }: {
  readonly session: PlayerSession;
  readonly revision: number;
  /** null outside a turn, where nobody has a next build to read yet. */
  readonly turnNumber: number | null;
  readonly setupAnalysis: PublicSetupAnalysisView | null;
  readonly players: RoomView["members"];
  readonly onFocusVertex?: (vertexId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // The log outlives the dialog: reopening should show everything asked for so
  // far, the way the public history does, rather than a blank panel.
  const [entries, setEntries] = useState<readonly CommentaryLogEntry[]>([]);
  const [mode, setMode] = useState<AiCommentaryMode>("commentary");
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CommentaryView>("log");
  // The server rations the intent read to one per turn. This only mirrors that
  // rule so the button can explain itself instead of spending a request on a
  // refusal; the server stays the one that decides.
  const [intentReadOnTurn, setIntentReadOnTurn] = useState<number | null>(null);
  const nextEntryId = useRef(1);
  const logEndRef = useRef<HTMLDivElement>(null);
  const previousSetupStatus = useRef<PublicSetupAnalysisView["status"] | null>(setupAnalysis?.status ?? null);

  // The opening read lands the moment setup finishes, which is exactly when the
  // first player is reaching for the dice. Opening the dialog for them put a
  // modal over the board at that moment -- and, because a modal hides the rest
  // of the page from assistive tech, over anything else reading the screen too.
  // Flag it on the button instead and let whoever wants it open it.
  const [unreadSetup, setUnreadSetup] = useState(false);

  useEffect(() => {
    const status = setupAnalysis?.status ?? null;
    if (previousSetupStatus.current === "loading" && status === "ready") {
      setActiveView("setup");
      setUnreadSetup(true);
    }
    previousSetupStatus.current = status;
  }, [setupAnalysis]);

  // Newest sits at the bottom, so a fresh entry has to be scrolled to.
  useLayoutEffect(() => {
    if (open && activeView === "log") logEndRef.current?.scrollIntoView({ block: "end" });
  }, [entries, open, activeView, loading]);

  const intentAvailable = turnNumber !== null && intentReadOnTurn !== turnNumber;

  const analyze = async () => {
    setActiveView("log");
    setLoading(true);
    setError(null);
    try {
      const result = await requestAiCommentary(session, revision, mode);
      if (result.mode === "intent") setIntentReadOnTurn(turnNumber);
      setEntries((current) => [...current, {
        id: nextEntryId.current++,
        mode: result.mode,
        revision: result.revision,
        content: result.content,
        intent: result.intent ?? null,
      }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 解说暂时没有回应");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="relative shrink-0"
          size="sm"
          variant="secondary"
          disabled={loading}
          aria-label={unreadSetup ? "AI 解说，开局点评已就绪" : undefined}
          onClick={() => {
            setActiveView(setupAnalysis === null ? "log" : "setup");
            setUnreadSetup(false);
          }}
        >
          <Sparkles className="size-4" />AI 解说
          {unreadSetup ? (
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#c2553c] ring-2 ring-[#f8ecd2]"
              data-ai-unread="true"
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden border-[#f7e6bf]/30 bg-[#f8ecd2] p-4 text-[#263d39] sm:max-w-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BrainCircuit className="size-5 text-[#a9593e]" />场边 AI</DialogTitle>
          <DialogDescription className="text-[#66716b]">
            开局点评对全桌公开且只读取初始选点；其他解说按当前座位可见信息生成。预测不参与规则裁定。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2" aria-label="AI 解说视图">
          {setupAnalysis === null ? null : (
            <Button
              type="button"
              size="sm"
              variant={activeView === "setup" ? "default" : "outline"}
              onClick={() => setActiveView("setup")}
            >
              {setupAnalysis.status === "loading" ? <RefreshCw className="size-3.5 animate-spin" /> : null}
              开局点评
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={activeView === "log" ? "default" : "outline"}
            onClick={() => setActiveView("log")}
          >
            场边解说{entries.length === 0 ? "" : ` (${entries.length})`}
          </Button>
        </div>

        {activeView === "setup" && setupAnalysis !== null
          ? <PublicSetupAnalysis analysis={setupAnalysis} players={players} />
          : <CommentaryLog
              entries={entries}
              revision={revision}
              players={players}
              loading={loading}
              error={error}
              endRef={logEndRef}
              onFocusVertex={onFocusVertex === undefined ? undefined : (vertexId) => {
                onFocusVertex(vertexId);
                setOpen(false);
              }}
            />}

        {activeView === "log" ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#6d5434]/15 pt-3">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="AI 解说类型">
              {MODES.map((option) => (
                <Button
                  key={option.mode}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={mode === option.mode}
                  variant={mode === option.mode ? "secondary" : "ghost"}
                  disabled={loading || (option.mode === "intent" && !intentAvailable)}
                  onClick={() => setMode(option.mode)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {intentAvailable || turnNumber === null ? null : (
              <p className="basis-full text-xs text-[#8a7a5c]">「大家在惦记什么」每回合只看一次，下个回合再来。</p>
            )}
            <Button
              type="button"
              size="sm"
              className="ms-auto"
              disabled={loading || (mode === "intent" && !intentAvailable)}
              onClick={() => void analyze()}
            >
              {loading ? <RefreshCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {loading ? "生成中…" : "生成"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CommentaryLog({ entries, revision, players, loading, error, endRef, onFocusVertex }: {
  readonly entries: readonly CommentaryLogEntry[];
  readonly revision: number;
  readonly players: RoomView["members"];
  readonly loading: boolean;
  readonly error: string | null;
  readonly endRef: RefObject<HTMLDivElement | null>;
  readonly onFocusVertex: ((vertexId: string) => void) | undefined;
}) {
  return (
    <div
      className="min-h-0 overflow-y-auto rounded-xl border border-[#6d5434]/15 bg-white/45 p-4 text-sm leading-7 text-[#344b46]"
      role="log"
      aria-label="AI 解说记录"
      aria-live="polite"
    >
      {entries.length === 0 && !loading && error === null ? (
        <p className="text-[#66716b]">选一种风格，点「生成」请 AI 看看现在这桌发生了什么。</p>
      ) : null}

      <ol className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-[#6d5434]/12 bg-white/55 px-3 py-2.5">
            <p className="mb-1 flex items-center gap-2 text-xs font-bold text-[#7d6136]">
              <span className="rounded-full bg-[#315f56]/12 px-2 py-0.5 text-[#315f56]">{MODE_LABELS[entry.mode]}</span>
              {entry.revision === revision
                ? null
                : <span className="font-normal text-[#9a623d]">棋局已推进，这段基于较早的局势</span>}
            </p>
            {toSentences(entry.content).map((sentence, index) => (
              <p key={index}>{sentence}</p>
            ))}
            {entry.intent === null ? null : (
              <IntentReading intent={entry.intent} players={players} onFocusVertex={onFocusVertex} />
            )}
          </li>
        ))}
      </ol>

      {loading ? (
        <p className="mt-3 flex items-center gap-2"><RefreshCw className="size-4 animate-spin" />AI 正在端详棋盘…</p>
      ) : null}
      {error !== null ? (
        <p className="mt-3 rounded-lg border border-[#b95642]/25 bg-[#fff2ec] px-3 py-2 text-[#914533]">{error}</p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

/**
 * One line per sentence.
 *
 * The model answers in a single dense paragraph, which is the wrong shape for
 * something read at a glance mid-turn. Splitting after full stops keeps the
 * model's own wording and only changes how it lands on screen.
 */
function toSentences(content: string): readonly string[] {
  const sentences = content
    .split(/(?<=[。！？])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  return sentences.length === 0 ? [content] : sentences;
}

/**
 * The intent read, one row per seat.
 *
 * A vertex id says nothing to a player, so the target is a button rather than
 * text: tapping it closes the dialog and lights that corner of the board up,
 * which is the only form in which "他想去这儿" is actually useful mid-turn.
 * Rows without a target stay text -- the server drops any spot the model did
 * not pick from its own offered list, and nothing invented gets to point at
 * the board.
 */
function IntentReading({ intent, players, onFocusVertex }: {
  readonly intent: TableIntentContent;
  readonly players: RoomView["members"];
  readonly onFocusVertex: ((vertexId: string) => void) | undefined;
}) {
  return (
    <ul className="mt-2 space-y-2 border-t border-[#6d5434]/12 pt-2">
      {intent.players.map((reading) => {
        const player = players.find((candidate) => candidate.id === reading.playerId);
        const target = reading.targetVertexId;
        return (
          <li key={reading.playerId} className="leading-6">
            <strong className="flex flex-wrap items-center gap-2 text-[#263d39]">
              {player === undefined ? null : <PlayerColorDot color={player.color} className="size-2.5" />}
              {player?.name ?? "玩家"}
              {target === null || onFocusVertex === undefined ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-xs font-normal"
                  onClick={() => onFocusVertex(target)}
                >
                  <Crosshair className="size-3" />
                  {reading.roadsNeeded === 0 ? "现在就能建" : `还差 ${reading.roadsNeeded ?? 0} 条路`}
                </Button>
              )}
            </strong>
            {toSentences(reading.intent).map((sentence, index) => (
              <p key={index}>{sentence}</p>
            ))}
            <p className="text-[#7a6a4f]">卡点 · {reading.blocker}</p>
          </li>
        );
      })}
    </ul>
  );
}

function PublicSetupAnalysis({ analysis, players }: {
  readonly analysis: PublicSetupAnalysisView;
  readonly players: RoomView["members"];
}) {
  if (analysis.status === "loading") {
    return (
      <div className="min-h-28 rounded-xl border border-[#6d5434]/15 bg-white/45 p-4 text-sm text-[#344b46]" aria-live="polite">
        <p className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin" />AI 正在逐个点评大家的初始选点…</p>
      </div>
    );
  }
  if (analysis.status === "failed") {
    return <div className="rounded-xl border border-[#b95642]/25 bg-[#fff2ec] p-4 text-sm text-[#914533]">{analysis.message}</div>;
  }

  const predictedWinner = players.find((player) => player.id === analysis.predictedWinnerId);
  return (
    <div className="min-h-0 space-y-3 overflow-y-auto pr-1 text-sm text-[#344b46]" role="region" aria-label="公开开局点评">
      <p className="rounded-lg bg-[#315f56]/10 px-3 py-2 text-xs font-bold text-[#315f56]">公开 Tips · 基于初始摆放完成时的全桌公开信息</p>
      <ul className="divide-y divide-[#6d5434]/12 rounded-xl border border-[#6d5434]/15 bg-white/45 px-4">
        {analysis.playerComments.map((entry) => {
          const player = players.find((candidate) => candidate.id === entry.playerId);
          return (
            <li key={entry.playerId} className="py-3 leading-6">
              <strong className="mb-0.5 flex items-center gap-2 text-[#263d39]">
                {player === undefined ? null : <PlayerColorDot color={player.color} className="size-2.5" />}
                {player?.name ?? "玩家"}
              </strong>
              {toSentences(entry.comment).map((sentence, index) => (
                <p key={index}>{sentence}</p>
              ))}
            </li>
          );
        })}
      </ul>
      <section className="rounded-xl border border-[#bf8d35]/25 bg-[#fff2cb]/75 p-4 leading-6">
        <strong className="mb-1 flex items-center gap-2 text-[#81551c]"><Trophy className="size-4" />娱乐性胜者预测 · {predictedWinner?.name ?? "某位玩家"}</strong>
        {toSentences(analysis.prediction).map((sentence, index) => (
          <p key={index}>{sentence}</p>
        ))}
      </section>
    </div>
  );
}
