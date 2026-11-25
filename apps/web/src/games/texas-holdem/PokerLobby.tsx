import { useEffect, useState } from "react";
import type { PokerRoomView, PokerSettings } from "@catan/protocol/texas-holdem";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
export function PokerLobby({ room, host, busy, onSettings, onStart, onShuffle }: { room: PokerRoomView; host: boolean; busy: boolean; onSettings: (s: PokerSettings) => Promise<void>; onStart: () => Promise<void>; onShuffle: () => Promise<void> }) {
  const [draft, setDraft] = useState(room.settings), key = JSON.stringify(room.settings);
  useEffect(() => setDraft(JSON.parse(key) as PokerSettings), [key]);
  const changed = JSON.stringify(draft) !== key;
  const field = "min-h-11 w-full rounded-lg border border-[#b4a58b] bg-[#fffdf6] px-3 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[#2f6f7a]";
  return <section className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl bg-[#f7ecd6] p-4 text-[#203b35] sm:p-7" aria-label="德州扑克房间设置">
    <div><h2 className="text-2xl font-bold">筹码摆好，等朋友入座</h2><p className="mt-2 text-sm leading-relaxed text-[#506158]">2–9 人无限注德州扑克。所有筹码仅供朋友间游戏，没有现金价值。断线时保留座位，超时自动过牌或弃牌。</p></div>
    <ul className="grid grid-cols-3 gap-2" aria-label="房间玩家">{room.members.map((p, i) => <li key={p.id} className="min-w-0 rounded-lg bg-[#e7dbc2] px-3 py-2"><span className="block truncate text-sm font-bold" title={p.name}>{p.name}</span><small className="text-[#526255]">座位 {i + 1}{p.isHost ? " · 房主" : ""}</small></li>)}</ul>
    <form onSubmit={(e) => { e.preventDefault(); void onSettings(draft); }}>
      <fieldset disabled={!host || busy} className="space-y-5">
        <legend className="mb-3 font-bold">本局玩法</legend>
        <div className="grid grid-cols-2 gap-2">{([{ id: "fixed-hands", name: "固定手数", detail: "固定盲注，结束比筹码" }, { id: "tournament", name: "锦标赛", detail: "逐级升盲，决出最后赢家" }] as const).map((m) => <label key={m.id} className={cn("flex cursor-pointer gap-2 rounded-xl border p-3", draft.mode === m.id ? "border-[#246357] bg-[#dbe7dc]" : "border-[#b4a58b]")}><input type="radio" name="poker-mode" value={m.id} checked={draft.mode === m.id} onChange={() => setDraft({ ...draft, mode: m.id })} className="mt-1 size-4 shrink-0 accent-[#246357]" /><span><strong className="block text-sm">{m.name}</strong><span className="mt-1 block text-xs leading-relaxed">{m.detail}</span></span></label>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium">初始筹码<input className={field} type="number" min={100} max={100000} required value={draft.startingChips} onChange={(e) => setDraft({ ...draft, startingChips: Number(e.target.value) })} /></label>
          <label className="grid gap-2 text-sm font-medium">小盲注<input className={field} type="number" min={1} max={Math.min(1000, Math.floor(draft.startingChips / 2))} required value={draft.smallBlind} onChange={(e) => setDraft({ ...draft, smallBlind: Number(e.target.value) })} /></label>
          {draft.mode === "fixed-hands" ? <label className="grid gap-2 text-sm font-medium">约定手数<input className={field} type="number" min={1} max={100} required value={draft.handLimit} onChange={(e) => setDraft({ ...draft, handLimit: Number(e.target.value) })} /></label>
            : <label className="grid gap-2 text-sm font-medium">每几手升盲<input className={field} type="number" min={1} max={50} required value={draft.blindInterval} onChange={(e) => setDraft({ ...draft, blindInterval: Number(e.target.value) })} /></label>}
          <label className="grid gap-2 text-sm font-medium">行动时限<select className={field} value={draft.actionSeconds} onChange={(e) => setDraft({ ...draft, actionSeconds: Number(e.target.value) as PokerSettings["actionSeconds"] })}>{[15, 30, 60].map((n) => <option key={n} value={n}>{n} 秒</option>)}</select></label>
        </div>
        <p className="text-sm text-[#506158]">大盲为 {draft.smallBlind * 2}。{draft.mode === "tournament" ? `每 ${draft.blindInterval} 手盲注翻倍，筹码归零即淘汰。` : `打完 ${draft.handLimit} 手按筹码排名，筹码相同并列。`}不补码、不重入。</p>
        {host && <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={!changed || busy}>保存设置</Button>}
      </fieldset>
    </form>
    {host ? <div className="flex gap-2"><Button className="min-h-12 flex-1" disabled={busy || changed || room.members.length < 2} onClick={() => void onStart()}>{changed ? "请先保存设置" : "开始德州扑克"}</Button><Button className="min-h-12" variant="outline" disabled={busy || room.members.length < 2} onClick={() => void onShuffle()}>打乱座位</Button></div> : <p role="status">等待房主设置并开始…</p>}
    <p className="text-xs leading-relaxed text-[#506158]">当前 {room.members.length}/9 人。庄位每手移动到下一位有筹码者；单挑时庄位兼小盲。只剩一人有筹码时提前结束。</p>
  </section>;
}
