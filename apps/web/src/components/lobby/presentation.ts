import { Castle, Dices, Flag, PencilLine, Spade } from "lucide-react";
import type { GameType } from "@catan/protocol/platform";

/** Display art only; rules, capacities and game names stay in their owning packages. */
export const PRESENTATIONS = {
  catan: { icon: Dices, accent: "#efc78b", backdrop: "#173e42", subtitle: "把远方，连成你的岛。", material: "海岛 · 资源 · 交易" },
  "draw-guess": { icon: PencilLine, accent: "#f3ba9d", backdrop: "#423b50", subtitle: "画着画着，就笑出了声。", material: "画画 · 猜词 · 接力" },
  "camel-up": { icon: Flag, accent: "#f2cd78", backdrop: "#4a3b2d", subtitle: "下一步，谁在谁上面？", material: "赛跑 · 叠驼 · 预测" },
  carcassonne: { icon: Castle, accent: "#c6d39a", backdrop: "#283e32", subtitle: "一块一块，拼出好风景。", material: "拼图 · 城镇 · 随从" },
  "texas-holdem": { icon: Spade, accent: "#dcc09a", backdrop: "#18382e", subtitle: "朋友到齐，好牌开场。", material: "牌桌 · 筹码 · 博弈" },
} as const satisfies Record<GameType, { icon: typeof Dices; accent: string; backdrop: string; subtitle: string; material: string }>;

export const entryField = "min-h-12 w-full rounded-xl border border-[#c7c7b8] bg-[#fffdf5] px-4 text-base text-[#233c35] caret-[#275b50] outline-none placeholder:text-[#70766a] focus-visible:border-[#275b50] focus-visible:ring-2 focus-visible:ring-[#275b50]/25 disabled:opacity-60";

/** Display names only; operational headings and all player text keep the UI face. */
export const GAME_TITLE_FONTS = {
  catan: "font-display font-semibold",
  "draw-guess": "font-display font-semibold",
  "camel-up": "font-camel font-normal",
  carcassonne: "font-display font-semibold",
  "texas-holdem": "font-display font-semibold",
} as const satisfies Record<GameType, string>;
