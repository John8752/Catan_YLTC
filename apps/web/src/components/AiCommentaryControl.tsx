import {
  AI_COMMENTARY_MODES,
  type AiCommentaryMode,
  type AiCommentaryResponse,
  type PublicSetupAnalysisView,
  type RoomView,
} from "@catan/protocol";
import { BrainCircuit, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils.js";
import { PlayerColorDot } from "./PlayerColorDot.js";

const MODE_LABELS: Readonly<Record<AiCommentaryMode, string>> = {
  commentary: "吐槽一下",
  summary: "总结局势",
  prediction: "预测走势",
};
const MODES = AI_COMMENTARY_MODES.map((mode) => ({ mode, label: MODE_LABELS[mode] }));

type CommentaryView = "setup" | AiCommentaryMode;

export function AiCommentaryControl({ session, revision, setupAnalysis, players }: {
  readonly session: PlayerSession;
  readonly revision: number;
  readonly setupAnalysis: PublicSetupAnalysisView | null;
  readonly players: RoomView["members"];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiCommentaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CommentaryView>("commentary");
  const previousSetupStatus = useRef<PublicSetupAnalysisView["status"] | null>(setupAnalysis?.status ?? null);

  useEffect(() => {
    const status = setupAnalysis?.status ?? null;
    if (previousSetupStatus.current === "loading" && status === "ready") {
      setActiveView("setup");
      setOpen(true);
    }
    previousSetupStatus.current = status;
  }, [setupAnalysis]);

  const analyze = async (mode: AiCommentaryMode) => {
    setActiveView(mode);
    setLoading(true);
    setError(null);
    try {
      setResult(await requestAiCommentary(session, revision, mode));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 解说暂时没有回应");
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = () => {
    if (setupAnalysis !== null) {
      setActiveView("setup");
      setError(null);
      return;
    }
    void analyze("commentary");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="shrink-0"
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={handleTrigger}
        >
          <Sparkles className="size-4" />AI 解说
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden border-[#f7e6bf]/30 bg-[#f8ecd2] p-4 text-[#263d39] sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BrainCircuit className="size-5 text-[#a9593e]" />场边 AI</DialogTitle>
          <DialogDescription className="text-[#66716b]">
            开局点评对全桌公开且只读取初始选点；其他解说按当前座位可见信息生成。预测不参与规则裁定。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2" aria-label="AI 解说类型">
          {setupAnalysis === null ? null : (
            <Button
              type="button"
              size="sm"
              variant={activeView === "setup" ? "default" : "outline"}
              disabled={loading}
              onClick={() => setActiveView("setup")}
            >
              {setupAnalysis.status === "loading" ? <RefreshCw className="size-3.5 animate-spin" /> : null}
              开局点评
            </Button>
          )}
          {MODES.map(({ mode, label }) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={activeView === mode ? "default" : "outline"}
              disabled={loading}
              onClick={() => void analyze(mode)}
            >
              {loading && activeView === mode ? <RefreshCw className="size-3.5 animate-spin" /> : null}
              {label}
            </Button>
          ))}
        </div>

        {activeView === "setup" && setupAnalysis !== null ? (
          <PublicSetupAnalysis analysis={setupAnalysis} players={players} />
        ) : <div
          className={cn(
            "min-h-0 overflow-y-auto rounded-xl border border-[#6d5434]/15 bg-white/45 p-4 text-sm leading-7 text-[#344b46]",
            error !== null && "border-[#b95642]/25 bg-[#fff2ec] text-[#914533]",
          )}
          aria-live="polite"
        >
          {loading ? (
            <p className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin" />AI 正在端详棋盘…</p>
          ) : error !== null ? (
            <p>{error}</p>
          ) : result === null ? (
            <p>点一种风格，请 AI 看看现在这桌发生了什么。</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap">{result.content}</p>
              {result.revision === revision ? null : (
                <p className="mt-3 text-xs font-bold text-[#9a623d]">棋局已经继续推进，这段解说基于较早的局势。</p>
              )}
            </>
          )}
        </div>}
      </DialogContent>
    </Dialog>
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
              <p>{entry.comment}</p>
            </li>
          );
        })}
      </ul>
      <section className="rounded-xl border border-[#bf8d35]/25 bg-[#fff2cb]/75 p-4 leading-6">
        <strong className="mb-1 flex items-center gap-2 text-[#81551c]"><Trophy className="size-4" />娱乐性胜者预测 · {predictedWinner?.name ?? "某位玩家"}</strong>
        <p>{analysis.prediction}</p>
      </section>
    </div>
  );
}
