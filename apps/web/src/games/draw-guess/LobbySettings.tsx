import type { DrawGuessRoomView, DrawGuessSettings } from "@catan/protocol/draw-guess";
import { entryField } from "../../components/lobby/presentation.js";

export function DrawLobbySettings({ room, host, busy, onChange }: { room: DrawGuessRoomView; host: boolean; busy: boolean; onChange: (settings: DrawGuessSettings) => void }) {
  return <section aria-label="传画猜词房间设置">
    <p className="mb-4 text-sm leading-6 text-[#566354]">每人从六个词中选一个先画，再轮流猜词、画画。所有人同时创作，最后一起翻开画册。</p>
    <div className="grid grid-cols-2 gap-3">
      <label className="grid gap-2 text-sm font-medium">猜词时间<select aria-label="猜词时间" className={entryField} disabled={!host || busy} value={room.settings.textSeconds} onChange={(e) => onChange({ ...room.settings, textSeconds: Number(e.target.value) as DrawGuessSettings["textSeconds"] })}>{[30, 60, 90].map(n => <option key={n} value={n}>{n} 秒</option>)}</select></label>
      <label className="grid gap-2 text-sm font-medium">画画时间<select aria-label="画画时间" className={entryField} disabled={!host || busy} value={room.settings.drawingSeconds} onChange={(e) => onChange({ ...room.settings, drawingSeconds: Number(e.target.value) as DrawGuessSettings["drawingSeconds"] })}>{[60, 90, 120].map(n => <option key={n} value={n}>{n} 秒</option>)}</select></label>
    </div>
    <p className="mt-4 mb-0 text-xs leading-5 text-[#566354]">超时自动收稿，最后由系统主持人自动翻画册。</p>
  </section>;
}
