import { CARCASSONNE_PLAYER_LIMITS } from "@catan/game-core/carcassonne";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Castle, Check, Shuffle, Trophy, Users, WifiOff, X } from "lucide-react";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { CarcassonneRoomView, LegalPlacement, PlaceCommand } from "@catan/protocol/carcassonne";
import type { Region } from "@catan/game-core/carcassonne";
import { PLAYER_COLORS } from "@catan/game-core/primitives";
import { getRoom, shuffleRoomMembers, updatePlayerColor } from "../../api.js";
import { Button } from "../../components/ui/button.js";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger } from "../../components/ui/dialog.js";
import type { PlayerSession } from "../../room-session.js";
import { PLAYER_COLOR_LABELS, PLAYER_SVG_COLORS } from "../../lib/player-palette.js";
import { randomId } from "../../lib/random-id.js";
import { cn } from "../../lib/utils.js";
import { sendCarcassonneCommand } from "./api.js";
import { CarcassonneBoard } from "./Board.js";
import { TileArt, MeepleArt, FEATURE_LABELS } from "./TileArt.js";
import { RoomMenu } from "./RoomMenu.js";
import { TurnDock } from "./TurnDock.js";
import "./map.css";
import type { RoomUpdates } from "../../room-updates.js";
import { confirmRoomCommand } from "../../lib/command-confirmation.js";

interface Props {
  readonly updates:RoomUpdates;
  readonly room:CarcassonneRoomView;readonly session:PlayerSession;readonly busy:boolean;readonly error:string|null;
  readonly connectionState:'connecting'|'live'|'offline';readonly accountControl:ReactNode;
  readonly setRoom:(r:AnyRoomView)=>void;readonly runBusy:(action:()=>Promise<void>)=>Promise<void>;
  readonly handleStart:()=>Promise<void>;readonly handleLeave:()=>Promise<void>;readonly handleDisband:()=>Promise<void>;readonly onReturnToLobby:()=>Promise<void>;
}
export function CarcassonneTable(props:Props) {
  const {room,session,busy,error,connectionState,setRoom,runBusy}=props,game=room.game,isHost=room.hostPlayerId===session.playerId;
  const [location,setLocation]=useState<{x:number;y:number}|null>(null),[rotation,setRotation]=useState(0),[step,setStep]=useState<'tile'|'meeple'>('tile');
  const [meeple,setMeeple]=useState<string|null>(null),[inspected,setInspected]=useState<Region|null>(null),[notice,setNotice]=useState<string|null>(null);
  const requestRef=useRef<{signature:string;id:string}|null>(null),lastScore=useRef(game?.scores.length??0),scoreMatch=useRef(game?.id);
  const turn=game?.phase.kind==='turn'?game.phase.turn:null;
  useEffect(()=>{setLocation(null);setRotation(0);setStep('tile');setMeeple(null);requestRef.current=null;},[game?.id,turn]);
  useEffect(()=>{
    if(!game){scoreMatch.current=undefined;lastScore.current=0;setNotice(null);return;}
    if(scoreMatch.current!==game.id){scoreMatch.current=game.id;lastScore.current=game.scores.length;setNotice(null);return;}
    if(game.scores.length<=lastScore.current){lastScore.current=game.scores.length;return;}
    const latest=game.scores.slice(lastScore.current);lastScore.current=game.scores.length;
    setNotice(latest.map((s)=>`${s.playerIds.map((id)=>game.players.find((p)=>p.id===id)?.name??'朋友').join('、')} ${FEATURE_LABELS[s.kind]} +${s.points}`).join(' · '));
    const timer=setTimeout(()=>setNotice(null),4500);return()=>clearTimeout(timer);
  },[game?.id,game?.scores.length]);
  useEffect(()=>setInspected(null),[game?.id]);
  const normalRotation=((rotation%4)+4)%4;
  const legal=location?game?.placements.find((p)=>p.x===location.x&&p.y===location.y&&p.rotation===normalRotation)??null:null;
  const selected:LegalPlacement|null=location?{...location,rotation:normalRotation,meepleOptions:legal?.meepleOptions??[]}:null;
  function select(p:LegalPlacement){setLocation({x:p.x,y:p.y});setRotation(p.rotation);setStep('tile');setMeeple(null);requestRef.current=null;}
  async function submit(){
    if(!game||game.phase.kind!=='turn'||!legal)return;
    const command:PlaceCommand={type:'place',matchId:game.id,turn:game.phase.turn,x:legal.x,y:legal.y,rotation:normalRotation,meeple};
    const signature=JSON.stringify(command);
    if(requestRef.current?.signature!==signature)requestRef.current={signature,id:randomId()};
    const requestId=requestRef.current.id;
    await runBusy(async()=>{
      try{await confirmRoomCommand(props.updates,session,await sendCarcassonneCommand(session,requestId,command),{gameId:"carcassonne",matchId:game.id,commandId:requestId,connected:connectionState==='live'});}
      catch(e){try{setRoom(await getRoom(session));}catch{/* Keep the editable preview while offline. */}throw e;}
    });
  }
  const menu=<RoomMenu room={room} busy={busy} isHost={isHost} accountControl={props.accountControl} onLeave={props.handleLeave} onDisband={props.handleDisband}/>;
  if(!game)return <Lobby {...props} menu={menu}/>;
  const finished=game.phase.kind==='finished';
  const selectedRegion=inspected?game.regions.find((r)=>r.refs.some((ref)=>inspected.refs.includes(ref)))??null:null;
  return <main className="carc-game grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden bg-[#143b32] px-[max(.5rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-[max(.35rem,env(safe-area-inset-top))] pb-[max(.5rem,env(safe-area-inset-bottom))] text-[#f4ecd8] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-4 lg:p-4" data-carc-game="true">
    <header className="shrink-0 min-w-0 lg:col-span-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d5bd83] text-[#43533a] shadow-[inset_0_1px_0_#fff2be,0_3px_5px_#09241f55]"><Castle className="size-5"/></span><h1 className="font-display text-lg font-semibold">卡卡颂</h1><span className="text-xs tabular-nums text-[#c5d1b6]">{finished?'已结算':`余 ${game.remainingTiles} 块`}</span></div>{menu}
      </div>
      <ol className="mt-1 grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-1.5" aria-label="座位与比分">
        {game.players.map((p)=>{const active=game.phase.kind==='turn'&&game.phase.playerId===p.id;return <li key={p.id} className={cn("min-w-0 rounded-xl border border-[#ffffff18] px-1.5 py-1.5 transition-[background-color,border-color] duration-200",active?'border-[#e4cb80] bg-[#e6d39b]/15':'bg-[#0c2a23]/35')} data-carc-player={p.id} data-active={active||undefined} aria-current={active?'step':undefined}>
          <div className="flex min-w-0 items-center gap-1"><svg className="size-5 shrink-0 overflow-visible" viewBox="-16 -18 32 36" aria-hidden="true"><MeepleArt color={PLAYER_SVG_COLORS[p.color]}/></svg><span className="min-w-0 flex-1 truncate text-xs font-medium lg:text-sm" title={p.name}>{p.id===session.playerId?'你':p.name}</span><strong className="text-sm tabular-nums lg:text-lg" aria-label={`${p.name} ${p.score} 分`}>{p.score}</strong></div>
          <p className="mt-0.5 text-center text-xs text-[#cad2ba]">余 {p.availableMeeples} 人</p>
        </li>;})}
      </ol>
      {connectionState!=='live'&&<p className="mt-1 flex items-center gap-1 text-xs text-[#f1d292]" role="status"><WifiOff className="size-3"/>{connectionState==='connecting'?'正在恢复连接…':'连接中断 · 预览仍可调整'}</p>}
    </header>
    <div className="relative flex min-h-0 min-w-0 lg:col-start-1 lg:row-start-2">
      <CarcassonneBoard key={game.id} game={game} selected={selected} rotation={rotation} meeple={meeple} step={step} busy={busy} valid={legal!==null} inspected={selectedRegion} onSelect={select} onInspect={setInspected} onMeeple={setMeeple}/>
      {notice&&<div key={`${game.id}:${game.scores.length}`} className="carc-score-notice pointer-events-none absolute top-16 right-3 left-3 rounded-xl bg-[#f5e4b6] px-3 py-2 text-center text-caption font-semibold text-[#39553b] shadow-lg" role="status">{notice}</div>}
      {selectedRegion&&<div className="absolute right-3 bottom-16 left-3 rounded-xl bg-[#f6efd9] p-3 text-[#2f4c38] shadow-lg" data-region-detail="true">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="text-sm">{FEATURE_LABELS[selectedRegion.kind]} · {selectedRegion.tileIds.length} 块板块</strong><p className="mt-1 text-xs leading-relaxed">{Object.keys(selectedRegion.followers).length?Object.entries(selectedRegion.followers).map(([id,n])=>`${game.players.find((p)=>p.id===id)?.name??'朋友'} ${n} 人`).join(' · '):'暂无随从占领'}{selectedRegion.kind==='field'?` · 接触 ${selectedRegion.completedCityIds.length} 座完成城市`:selectedRegion.complete?' · 已完成':` · 未完成`}</p><p className="mt-1 text-xs">{selectedRegion.kind==='field'?'终局田地价值':selectedRegion.complete?'区域价值':'当前终局价值'} {selectedRegion.points} 分{selectedRegion.winnerIds.length?` · ${selectedRegion.winnerIds.map((id)=>game.players.find((p)=>p.id===id)?.name).join('、')}占优`:''}</p></div><Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="关闭区域详情" onClick={()=>setInspected(null)}><X/></Button></div>
      </div>}
    </div>
    <aside className="min-h-0 min-w-0 lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:justify-end" aria-label="行动与结算">
      {error&&<p className="mb-2 max-h-20 overflow-y-auto rounded-xl bg-[#f8dfce] p-2 text-xs text-[#853d28]" role="alert">{error}</p>}
      {finished?<section className="rounded-2xl bg-[#f4ecd8] p-4 text-[#2f4d39] shadow-lg"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#d9c28a] shadow-inner"><Trophy className="text-[#745124]"/></span><div className="min-w-0"><h2 className="font-bold">这片风景，有了归属</h2><p className="mt-1 break-words text-sm">{game.phase.kind==='finished'&&game.phase.winnerIds.map((id)=>game.players.find((p)=>p.id===id)?.name).join('、')} 获胜</p></div></div>
        <Dialog><DialogTrigger asChild><Button variant="outline" className="mt-3 min-h-11 w-full">查看最终排名</Button></DialogTrigger><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#f8f1de]"><DialogHeader><DialogTitle>最终排名</DialogTitle><DialogDescription>已包含农夫与所有未完成区域的终局分数。</DialogDescription></DialogHeader><ol className="space-y-3">{[...game.players].sort((a,b)=>b.score-a.score).map((p)=><li key={p.id} className="flex items-center gap-3"><strong className="w-8">{1+game.players.filter((q)=>q.score>p.score).length}</strong><span className="min-w-0 flex-1 break-all">{p.name}</span><strong>{p.score} 分</strong></li>)}</ol></DialogContent></Dialog>
        {isHost?<Button className="mt-2 min-h-11 w-full bg-[#335e43] text-[#fff6dc] hover:bg-[#294e37]" disabled={busy} onClick={()=>void props.onReturnToLobby()}>再来一局<ArrowRight/></Button>:<p className="mt-3 text-center text-xs">等待房主开始下一局</p>}</section>
        :<TurnDock game={game} selected={selected} rotation={rotation} step={step} meeple={meeple} valid={legal!==null} busy={busy} offline={connectionState!=='live'} retrying={Boolean(error&&requestRef.current)} onRotate={()=>{setRotation((r)=>r+1);setMeeple(null);requestRef.current=null;}} onContinue={()=>setStep('meeple')} onBack={()=>{setStep('tile');setMeeple(null);requestRef.current=null;}} onMeeple={(id)=>{setMeeple(id);requestRef.current=null;}} onSubmit={()=>void submit()}/>}
    </aside>
  </main>;
}
function Lobby(props:Props&{readonly menu:ReactNode}){
  const {room,session,busy,setRoom,runBusy}=props,isHost=room.hostPlayerId===session.playerId,own=room.members.find((p)=>p.id===session.playerId)!;
  return <main className="carc-game min-h-svh bg-[#143b32] px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-[max(.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-[#f4ecd8]">
    <div className="mx-auto max-w-4xl"><header className="flex items-center justify-between gap-2"><h1 className="flex items-center gap-2 font-bold"><Castle className="text-[#d9c28a]"/>卡卡颂</h1>{props.menu}</header>
      <div className="grid items-center gap-7 py-5 lg:min-h-[75dvh] lg:grid-cols-2 lg:gap-12">
        <section><svg className="mx-auto w-full max-w-[360px] overflow-visible" viewBox="-45 -30 330 240" role="img" aria-label="立体板块玩法预览，城墙、道路和随从"><g transform="translate(40 40) rotate(-8 100 50)"><g transform="translate(0 0)"><TileArt type="D"/><g transform="translate(50 18)"><MeepleArt color="#c94f3d"/></g></g><g transform="translate(100 0)"><TileArt type="U" rotation={1}/></g><g transform="translate(0 100)"><TileArt type="B"/><g transform="translate(50 50)"><MeepleArt color="#3e6fb0"/></g></g></g></svg>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-[#f4e5ba]">一块一块，<br/>拼出你的城。</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-[#c0cbb1]">城墙渐渐合拢，道路向远方延伸。派出随从抢占好位置，也留意朋友下一块会接在哪里。</p>
        </section>
        <section className="rounded-2xl bg-[#f4ecd8] p-5 text-[#2e4938] shadow-[0_12px_35px_#071f2145]" aria-label="卡卡颂大厅">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">等待朋友入座</h2><p className="mt-1 text-xs text-[#677055]">基础版 · 2–5 人 · 含农夫</p></div><strong className="font-mono text-xl tracking-wider" aria-label="房间码">{room.id}</strong></div>
          <ol className="mt-5 divide-y divide-[#d8cfb6]">{room.members.map((p)=><li key={p.id} className="flex items-center gap-3 py-3"><svg className="size-8 shrink-0 overflow-visible" viewBox="-16 -18 32 36" aria-hidden="true"><MeepleArt color={PLAYER_SVG_COLORS[p.color]}/></svg><span className="min-w-0 flex-1 truncate text-sm font-semibold" title={p.name}>{p.name}{p.id===session.playerId?'（你）':''}</span><span className="text-xs text-[#667154]">{p.isHost?'房主':'已入座'}</span></li>)}</ol>
          <Dialog><DialogTrigger asChild><Button variant="outline" className="mt-3 min-h-11 w-full"><Users/>选择我的随从颜色</Button></DialogTrigger><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#f8f1de]"><DialogHeader><DialogTitle>选择随从颜色</DialogTitle><DialogDescription>颜色与房间座位绑定，开局后保留。</DialogDescription></DialogHeader><div className="grid grid-cols-3 gap-2">{PLAYER_COLORS.map((color)=>{const taken=room.members.some((m)=>m.id!==own.id&&m.color===color);return <Button key={color} variant="outline" className="h-auto min-h-20 flex-col py-3 text-xs" disabled={busy||taken} aria-pressed={own.color===color} onClick={()=>void runBusy(async()=>setRoom(await updatePlayerColor(session,room.revision,color)))}><svg className="size-7 overflow-visible" viewBox="-16 -18 32 36" aria-hidden="true"><MeepleArt color={PLAYER_SVG_COLORS[color]}/></svg>{PLAYER_COLOR_LABELS[color]}{own.color===color&&<Check className="size-3"/>}{taken&&'已选'}</Button>;})}</div></DialogContent></Dialog>
          {isHost?<div className="mt-3 flex gap-2"><Button className="min-h-12 flex-1 bg-[#335e43] text-[#fff6dc] hover:bg-[#294e37]" disabled={busy||room.members.length<CARCASSONNE_PLAYER_LIMITS.min||props.connectionState!=='live'} onClick={()=>void props.handleStart()}>开始拼城<ArrowRight/></Button><Button variant="outline" className="min-h-12" aria-label="打乱座位" disabled={busy||room.members.length<2} onClick={()=>void runBusy(async()=>setRoom(await shuffleRoomMembers(session,room.revision)))}><Shuffle/></Button></div>:<p className="mt-4 text-center text-sm" role="status">等待房主开始…</p>}
          <p className="mt-3 text-center text-xs leading-relaxed text-[#687155]">{room.members.length<2?'把房间码发给朋友，再来一人就能开局。':'所有人按座位顺序行动，语音请用熟悉的软件。'}</p>
          {props.error&&<p role="alert" className="mt-3 text-sm text-[#974631]">{props.error}</p>}
        </section>
      </div>
    </div>
  </main>;
}
