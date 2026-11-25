import type { ReactNode } from "react";
import { BookOpen, History, Menu, Castle } from "lucide-react";
import type { CarcassonneRoomView } from "@catan/protocol/carcassonne";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger } from "../../components/ui/dialog.js";
import { Button } from "../../components/ui/button.js";
import { DisbandRoomControl } from "../../components/DisbandRoomControl.js";
import { FEATURE_LABELS } from "./TileArt.js";

export function RulesContent() {
  return <div className="space-y-4 text-sm leading-relaxed text-[#425849]">
    <p>轮流抽取一块板块，拼到地图边缘。所有相邻边必须接得上：道路接道路、城市接城市、草地接草地。</p>
    <p>每回合可在新板块放一名随从。整个连通区域已有任何人的随从时不能再放；后来合并的区域按人数最多者计分，并列最多者各得全分。</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2"><dt className="font-bold">道路</dt><dd>两端封住或闭环即完成，每块板块 1 分。</dd><dt className="font-bold">城市</dt><dd>城墙闭合且无缺口即完成，每块板块 2 分，每个盾徽加 2 分。</dd><dt className="font-bold">修道院</dt><dd>自身加周围八格齐全时得 9 分。</dd><dt className="font-bold">农夫</dt><dd>横放在田地上，整局不收回。终局每接触一座不同的已完成城市得 3 分。</dd></dl>
    <p>已完成区域计分后，收回其中的随从。板块抽完后结算剩余区域：道路每块 1 分，城市每块和每个盾徽各 1 分，修道院按已有邻格加自身计分。最高分获胜，可并列。</p>
    <p className="rounded-xl bg-[#e6ebd9] p-3">拖动地图浏览，双指缩放。先预览板块，再选随从，最后点击“完成回合”。提交前可以返回修改；离线时保留预览，恢复连接后继续。</p>
  </div>;
}
export function RoomMenu({room,busy,isHost,accountControl,onLeave,onDisband}:{readonly room:CarcassonneRoomView;readonly busy:boolean;readonly isHost:boolean;readonly accountControl:ReactNode;readonly onLeave:()=>Promise<void>;readonly onDisband:()=>Promise<void>}) {
  return <div className="flex items-center gap-1">
    <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-[#f0e5c8] hover:bg-white/10 hover:text-white" aria-label="游戏规则"><BookOpen/></Button></DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#f8f1de]"><DialogHeader><DialogTitle>卡卡颂怎么玩</DialogTitle><DialogDescription>基础版 · 72 块板块 · 每人 7 名随从</DialogDescription></DialogHeader><RulesContent/></DialogContent></Dialog>
    {room.game&&<Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-[#f0e5c8] hover:bg-white/10 hover:text-white" aria-label="计分记录"><History/></Button></DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#f8f1de]"><DialogHeader><DialogTitle>计分记录</DialogTitle><DialogDescription>只记录服务器已确认的结算。</DialogDescription></DialogHeader>
        {room.game.scores.length===0?<p className="py-6 text-center text-sm text-muted-foreground">尚未有区域完成，先铺出第一段风景。</p>:<ol className="space-y-3">{[...room.game.scores].reverse().map((s)=><li key={s.id} className="flex items-start gap-3 border-b border-[#d6ceb4] pb-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e3d9bd] text-[#66522f]"><Castle className="size-4"/></span><div className="min-w-0 flex-1 text-sm"><strong>{s.playerIds.map((id)=>room.members.find((p)=>p.id===id)?.name??'朋友').join('、')}</strong><p className="text-[#5c6856]">{s.final?'终局 · ':''}{FEATURE_LABELS[s.kind]} · {s.tileIds.length} 块板块</p></div><strong className="text-lg tabular-nums text-[#335d40]">+{s.points}</strong></li>)}</ol>}
      </DialogContent></Dialog>}
    <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-[#f0e5c8] hover:bg-white/10 hover:text-white" aria-label="房间菜单"><Menu/></Button></DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#f8f1de]"><DialogHeader><DialogTitle>一起拼出的风景</DialogTitle><DialogDescription>卡卡颂 · 房间码 {room.id}</DialogDescription></DialogHeader>
        <ul className="space-y-2">{room.members.map((m)=><li key={m.id} className="flex justify-between gap-3 text-sm"><span className="break-all">{m.name}</span><span className="shrink-0 text-muted-foreground">{m.isHost?'房主':'已入座'}</span></li>)}</ul>
        {accountControl}{(!room.game||room.game.phase.kind==='finished')&&<Button variant="outline" disabled={busy} onClick={()=>void onLeave()}>离开房间</Button>}
        {isHost&&<DisbandRoomControl room={room} busy={busy} onDisband={onDisband}/>}</DialogContent></Dialog>
  </div>;
}
