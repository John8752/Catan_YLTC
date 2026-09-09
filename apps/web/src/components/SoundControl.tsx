import { Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button.js";

export function SoundControl({ enabled, toggle }: { readonly enabled: boolean; readonly toggle: () => void }) {
  return <Button type="button" size="icon-sm" variant="ghost" onClick={toggle}
    aria-label={enabled ? "关闭游戏音效" : "开启游戏音效"} aria-pressed={enabled}
    title={enabled ? "关闭游戏音效" : "开启游戏音效"}
    className="text-[#fff1cf] hover:bg-white/10 hover:text-white">
    {enabled ? <Volume2 /> : <VolumeX />}
  </Button>;
}
