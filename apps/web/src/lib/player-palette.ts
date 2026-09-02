import type { PlayerColor } from "@catan/game-core";

export const PLAYER_SWATCH_CLASSES = {
  terracotta: "bg-[#c94f3d]",
  ocean: "bg-[#3e6fb0]",
  pine: "bg-[#36afa6]",
  wheat: "bg-[#d6a12b]",
  plum: "bg-[#805a9d]",
  charcoal: "bg-[#e3dccb] ring-[#5b554b]/80",
  coral: "bg-[#c95c7b]",
  orange: "bg-[#d9782d]",
  navy: "bg-[#274c77]",
  emerald: "bg-[#2f8f62]",
  lavender: "bg-[#a579b7]",
  graphite: "bg-[#4a5052]",
} as const satisfies Record<PlayerColor, string>;

export const PLAYER_TONE_CLASSES = {
  terracotta: "border-[#c94f3d]/45 bg-[#c94f3d]/10 text-[#8f3328]",
  ocean: "border-[#3e6fb0]/45 bg-[#3e6fb0]/10 text-[#274c7c]",
  pine: "border-[#36afa6]/45 bg-[#36afa6]/10 text-[#17645e]",
  wheat: "border-[#d6a12b]/45 bg-[#d6a12b]/10 text-[#7c5a10]",
  plum: "border-[#805a9d]/45 bg-[#805a9d]/10 text-[#583d70]",
  charcoal: "border-[#756e60]/45 bg-[#e3dccb]/25 text-[#4f4a42]",
  coral: "border-[#c95c7b]/45 bg-[#c95c7b]/10 text-[#84384f]",
  orange: "border-[#d9782d]/45 bg-[#d9782d]/10 text-[#8a4515]",
  navy: "border-[#274c77]/45 bg-[#274c77]/10 text-[#1b3858]",
  emerald: "border-[#2f8f62]/45 bg-[#2f8f62]/10 text-[#1d6643]",
  lavender: "border-[#a579b7]/45 bg-[#a579b7]/10 text-[#684677]",
  graphite: "border-[#4a5052]/45 bg-[#4a5052]/10 text-[#34393a]",
} as const satisfies Record<PlayerColor, string>;

export const PLAYER_COLOR_LABELS = {
  terracotta: "朱砂红",
  ocean: "钴蓝",
  pine: "蒂芙尼青",
  wheat: "琥珀黄",
  plum: "皇家紫",
  charcoal: "象牙白",
  coral: "珊瑚粉",
  orange: "赤陶橙",
  navy: "午夜蓝",
  emerald: "翡翠绿",
  lavender: "薰衣草紫",
  graphite: "石墨黑",
} as const satisfies Record<PlayerColor, string>;
