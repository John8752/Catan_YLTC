import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Focus, Minus, Plus } from "lucide-react";
import type { CamelGameView } from "@catan/protocol/camel-up";
import { CAMEL_NAMES } from "@catan/protocol/camel-up";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { RaceFeedback } from "./RaceFeedback.js";
import type { ArenaController } from "./three/scene.js";
const CompatibilityBoard = lazy(() => import("./FlatRaceBoard.js").then(m => ({ default: m.FlatRaceBoard })));
export function RaceBoard({ game, tileSpaces = [], onSpace, fit = false, effect = null }: { effect?: CamelGameView["effect"]; game: CamelGameView | null; tileSpaces?: number[]; onSpace?: (space: number) => void; fit?: boolean }) {
  const host = useRef<HTMLDivElement>(null), arena = useRef<ArenaController | null>(null);
  const latest = useRef({ game, tileSpaces, onSpace, effect }); latest.current = { game, tileSpaces, onSpace, effect };
  const [status, setStatus] = useState<"loading" | "ready" | "compatibility">("loading");
  useEffect(() => {
    let active = true;
    void import("./three/scene.js").then(({ createArena }) => {
      if (!active || !host.current) return;
      try { arena.current = createArena(host.current, latest.current, () => setStatus("compatibility")); setStatus("ready"); }
      catch { setStatus("compatibility"); }
    }).catch(() => active && setStatus("compatibility"));
    return () => { active = false; arena.current?.dispose(); arena.current = null; };
  }, []);
  useEffect(() => { arena.current?.update({ game, tileSpaces, onSpace, effect }); }, [game, tileSpaces, onSpace, effect]);
  useEffect(() => { if (status === "compatibility") { arena.current?.dispose(); arena.current = null; } }, [status]);
  if (status === "compatibility") return <Suspense fallback={<p role="status">正在准备赛场…</p>}><CompatibilityBoard game={game} tileSpaces={tileSpaces} fit={fit} {...(onSpace ? { onSpace } : {})} /></Suspense>;
  return <div className={cn("relative isolate w-full overflow-hidden rounded-2xl bg-[#ccddcd] bg-[radial-gradient(ellipse_at_45%_35%,#eef0d8_0%,#b8d2c2_70%,#8bb5ac_100%)]", fit ? "h-full" : "aspect-[4/3]")} aria-label="骆驼赛道">
    <div ref={host} data-testid="three-arena" className="absolute inset-0" />
    {status === "loading" && <p role="status" className="absolute inset-0 grid place-items-center text-base text-[#264d43]">正在铺好立体沙盘…</p>}
    <div className="absolute right-2 top-2 flex gap-1 rounded-xl bg-[#153b3d]/90 p-1 text-[#f6ebce]">
      <Button aria-label="放大赛场" variant="ghost" className="size-11 hover:bg-white/15 hover:text-white" disabled={status !== "ready"} onClick={() => arena.current?.zoom(1.2)}><Plus /></Button>
      <Button aria-label="缩小赛场" variant="ghost" className="size-11 hover:bg-white/15 hover:text-white" disabled={status !== "ready"} onClick={() => arena.current?.zoom(1 / 1.2)}><Minus /></Button>
      <Button aria-label="复位视角" variant="ghost" className="size-11 hover:bg-white/15 hover:text-white" disabled={status !== "ready"} onClick={() => arena.current?.reset()}><Focus /></Button>
    </div>
    <p className="pointer-events-none absolute bottom-2 left-0 mb-0 w-full text-center text-sm text-[#284c43]">拖动旋转 · 双指缩放</p>
    {game && <RaceFeedback game={game} effect={effect} />}
    <ol className="sr-only" aria-label="骆驼位置">{game && Object.entries(game.stacks).flatMap(([space, stack]) => stack.map((camel, i) => <li key={camel}>{CAMEL_NAMES[camel]}，第 {space} 格，从下数第 {i + 1} 层</li>))}</ol>
  </div>;
}
