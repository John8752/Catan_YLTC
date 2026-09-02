import type { GameView, TurnQueueEntryView } from "@catan/protocol";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { PlayerColorDot } from "./PlayerColorDot.js";

export function TurnForecastBar({ game, actions }: {
  readonly game: GameView;
  readonly actions?: ReactNode;
}) {
  if (game.phase.kind !== "turn" || game.turnQueue.length === 0) {
    return actions === undefined ? null : (
      <section className="flex w-fit shrink-0 items-center rounded-xl border border-[#f0c56b]/35 bg-[#102f31]/94 px-1 py-0.5 shadow-[0_5px_16px_rgba(6,31,32,.2)]" data-turn-forecast-utilities-only="true">
        {actions}
      </section>
    );
  }

  const selfIndex = game.turnQueue.findIndex((entry) => entry.playerId === game.you.id);
  const indexes = visibleIndexes(game.turnQueue.length);
  const current = game.turnQueue[0];
  if (current === undefined) return null;

  return (
    <section
      className={cn(
        "relative order-3 flex min-w-0 basis-full items-center gap-2 rounded-xl border border-[#f0c56b]/35 bg-[#102f31]/94 px-2 py-1.5 text-[#fff8df] shadow-[0_5px_16px_rgba(6,31,32,.2)]",
        "phone-landscape:order-0 phone-landscape:w-[14.25rem] phone-landscape:min-w-0 phone-landscape:flex-none phone-landscape:basis-auto phone-landscape:px-1.5 phone-landscape:py-1",
        "lg:order-0 lg:grid lg:w-full lg:basis-auto lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-2 lg:gap-y-1 lg:border-[#d1b793]/20 lg:bg-[#142c2c] lg:px-2.5 lg:py-1.5 lg:shadow-none",
        "xl:z-10 xl:w-[25rem] xl:flex-none",
        selfIndex === 0 && "border-[#f2b3aa]/80 bg-[#493837] ring-1 ring-[#f2b3aa]/45 lg:bg-[#3b3131]",
      )}
      aria-label={`操作队列，${forecastSummary(game, selfIndex)}`}
      data-turn-forecast="true"
      data-turn-forecast-distance={selfIndex}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 phone-landscape:hidden lg:contents">
        <div className="min-w-0 shrink-0 lg:col-start-1 lg:row-start-1 lg:flex lg:items-baseline lg:gap-1.5">
          <span className="block whitespace-nowrap text-[9px] font-black tracking-[.12em] text-[#d9c397] uppercase lg:inline lg:text-xs">
            第 {current.turnNumber} 回合
          </span>
          <strong className="block whitespace-nowrap text-[11px] leading-tight text-[#fff4d6] lg:inline lg:text-sm" data-turn-forecast-summary="true">
            {forecastSummary(game, selfIndex)}
          </strong>
        </div>

        <ol className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:justify-start lg:pb-0.5" aria-label="接下来的操作顺序">
          {indexes.map((index, visibleIndex) => {
            const entry = game.turnQueue[index];
            if (entry === undefined) return null;
            const previousIndex = indexes[visibleIndex - 1];
            const skipped = previousIndex === undefined ? 0 : index - previousIndex - 1;
            return (
              <li className="contents" key={`${entry.turnNumber}:${entry.kind}:${entry.playerId}`}>
                {visibleIndex === 0 ? null : (
                  <span className="shrink-0 text-[8px] font-black text-[#d9c397]/80 lg:text-[10px]" aria-hidden="true">
                    {skipped > 0 ? `+${skipped}` : "›"}
                  </span>
                )}
                <QueuePlayer game={game} entry={entry} current={index === 0} self={entry.playerId === game.you.id} />
              </li>
            );
          })}
        </ol>
      </div>
      <LandscapeQueue game={game} selfIndex={selfIndex} />
      {actions === undefined ? null : (
        <div className="flex shrink-0 items-center lg:col-start-2 lg:row-start-1 lg:self-start">
          {actions}
        </div>
      )}
    </section>
  );
}

function LandscapeQueue({ game, selfIndex }: { readonly game: GameView; readonly selfIndex: number }) {
  const current = game.turnQueue[0];
  const target = selfIndex === 0 ? game.turnQueue[1] : game.turnQueue[selfIndex];
  if (current === undefined || target === undefined) return null;
  return (
    <div className="hidden min-w-0 flex-1 items-center justify-between gap-1 phone-landscape:flex phone-landscape:overflow-x-auto lg:hidden" data-landscape-turn-queue="true">
      <strong className="shrink-0 whitespace-nowrap text-[10px] text-[#fff4d6]">
        {compactForecastSummary(game, selfIndex)}
      </strong>
      <div className="flex min-w-0 items-center gap-1" aria-label="紧凑操作顺序">
        <CompactQueuePlayer game={game} entry={current} self={current.playerId === game.you.id} />
        <span className="shrink-0 text-[8px] font-black text-[#d9c397]/80" aria-hidden="true">
          {selfIndex > 1 ? `+${selfIndex - 1}` : "›"}
        </span>
        <CompactQueuePlayer game={game} entry={target} self={target.playerId === game.you.id} />
      </div>
    </div>
  );
}

function CompactQueuePlayer({ game, entry, self }: {
  readonly game: GameView;
  readonly entry: TurnQueueEntryView;
  readonly self: boolean;
}) {
  const player = game.players.find((candidate) => candidate.id === entry.playerId);
  if (player === undefined) return null;
  return (
    <span className={cn("flex min-w-0 shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1 py-0.5 text-[9px] font-black", self && "border-[#f2b3aa]/65 bg-[#f2b3aa]/14 text-[#ffe2dc]")}>
      <PlayerColorDot color={player.color} className="size-2 shrink-0 rounded-sm" />
      <span className="max-w-8 truncate">{self ? "你" : player.name}</span>
      <b className="shrink-0 text-[8px] text-[#ead6aa]">{entry.kind === "primary" ? "主" : "搭"}</b>
    </span>
  );
}

function QueuePlayer({ game, entry, current, self }: {
  readonly game: GameView;
  readonly entry: TurnQueueEntryView;
  readonly current: boolean;
  readonly self: boolean;
}) {
  const player = game.players.find((candidate) => candidate.id === entry.playerId);
  if (player === undefined) return null;
  const kind = entry.kind === "primary" ? "主" : "搭";
  const name = self ? "你" : player.name;

  return (
    <span
      className={cn(
        "flex min-w-0 max-w-[5rem] shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] font-black lg:max-w-[6rem] lg:text-xs",
        current && "border-[#f0c56b]/60 bg-[#f0c56b]/14 text-[#fff0bd]",
        self && "border-[#f2b3aa]/65 bg-[#f2b3aa]/14 text-[#ffe2dc]",
      )}
      data-turn-queue-player={entry.playerId}
      data-turn-queue-kind={entry.kind}
      data-turn-queue-current={current || undefined}
      data-turn-queue-self={self || undefined}
      title={`${name} · ${entry.kind === "primary" ? "主回合" : "搭档行动"}`}
    >
      <PlayerColorDot color={player.color} className="size-2 shrink-0 rounded-sm lg:size-2.5" />
      <span className="min-w-0 truncate">{name}</span>
      <b className="shrink-0 rounded bg-black/15 px-0.5 text-[9px] text-[#ead6aa] lg:text-[10px]">{kind}</b>
    </span>
  );
}

function forecastSummary(game: GameView, selfIndex: number): string {
  const own = game.turnQueue[selfIndex];
  if (own === undefined) return "查看接下来的操作顺序";
  const kind = own.kind === "primary" ? "主回合" : "搭档行动";
  if (selfIndex === 0) return `轮到你了 · ${kind}`;
  if (selfIndex === 1) return `接下来轮到你 · ${kind}`;
  return `再过 ${selfIndex - 1} 次操作 · ${kind}`;
}

function compactForecastSummary(game: GameView, selfIndex: number): string {
  const own = game.turnQueue[selfIndex];
  if (own === undefined) return "操作队列";
  const kind = own.kind === "primary" ? "主回合" : "搭档行动";
  if (selfIndex === 0) return `轮到你 · ${kind}`;
  if (selfIndex === 1) return `下一位是你 · ${kind}`;
  return `再过 ${selfIndex - 1} 次 · ${kind}`;
}

function visibleIndexes(queueLength: number): readonly number[] {
  return Array.from({ length: queueLength }, (_, index) => index);
}
