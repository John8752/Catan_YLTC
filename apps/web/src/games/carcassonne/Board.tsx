import { lazy,Suspense,useEffect,useRef,useState } from "react";
import { Expand,Focus,MapPin,Minus,Plus,Rotate3D,Layers,Mountain,LoaderCircle,Map } from "lucide-react";
import type { CarcassonneView,LegalPlacement } from "@catan/protocol/carcassonne";
import type { Region } from "@catan/game-core/carcassonne";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { FEATURE_LABELS } from "./TileArt.js";
import type { Arena,SceneFrame } from "./three/scene.js";

const FlatBoard=lazy(()=>import("./FlatBoard.js").then(m=>({default:m.FlatCarcassonneBoard})));
export interface BoardProps {
  readonly game:CarcassonneView;readonly selected:LegalPlacement|null;readonly rotation:number;readonly meeple:string|null;
  readonly step:"tile"|"meeple";readonly busy:boolean;readonly valid:boolean;readonly inspected:Region|null;
  readonly onSelect:(p:LegalPlacement)=>void;readonly onInspect:(r:Region|null)=>void;readonly onMeeple:(id:string)=>void;
}
export function CarcassonneBoard(props:BoardProps){
  const host=useRef<HTMLDivElement>(null),arena=useRef<Arena|null>(null),latest=useRef(props);latest.current=props;
  const [status,setStatus]=useState<"loading"|"ready"|"compatibility">("loading"),[regionsOpen,setRegionsOpen]=useState(false);
  const [frame,setFrame]=useState<SceneFrame>({targets:[],zoom:1,azimuth:0,view:"perspective",allTilesVisible:true,tileCount:0,settled:true});
  const frameRef=useRef(frame);frameRef.current=frame;
  useEffect(()=>{
    let cancelled=false;
    import("./three/scene.js").then(({createArena})=>{
      if(cancelled||!host.current)return;
      try{arena.current=createArena(host.current,latest.current,{
        frame:f=>{if(!cancelled)setFrame(f);},inspect:r=>latest.current.onInspect(r),
        select:p=>{if(latest.current.busy)return;latest.current.onInspect(null);latest.current.onSelect(p);if(frameRef.current.zoom<.65)arena.current?.focus(p.x,p.y);},
        meeple:id=>latest.current.onMeeple(id),
        failure:()=>{if(!cancelled){setStatus("compatibility");arena.current?.dispose();arena.current=null;}},
      });setStatus("ready");}catch{setStatus("compatibility");}
    }).catch(()=>{if(!cancelled)setStatus("compatibility");});
    return()=>{cancelled=true;arena.current?.dispose();arena.current=null;};
  },[]);
  useEffect(()=>{arena.current?.update(props);},[props]);
  if(status==="compatibility")return <div className="relative flex min-h-0 min-w-0 flex-1" data-carc-renderer="compatibility"><Suspense fallback={<p role="status">正在打开兼容地图…</p>}><FlatBoard {...props}/></Suspense><span className="pointer-events-none absolute top-14 left-3 rounded bg-[#f4ecd8] px-2 py-1 text-[10px] text-[#34523f]" role="status">当前设备使用兼容地图</span></div>;
  const {game,selected,step,busy}=props,active=game.phase.kind==="turn"&&game.phase.playerId===game.you.id;
  return <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#c3d4b7] shadow-[inset_0_4px_24px_#526a3b20] lg:rounded-3xl" aria-label="卡卡颂三维领地" data-carc-map="true" data-carc-renderer={status}
    data-camera-size={frame.zoom} data-camera-azimuth={frame.azimuth} data-camera-view={frame.view} data-camera-settled={frame.settled} data-all-tiles-visible={frame.allTilesVisible} data-tile-count={frame.tileCount}>
    <div className="absolute inset-0 touch-none">
    <div ref={host} className="absolute inset-0"/>
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {frame.targets.filter(t=>t.x>16&&t.y>45&&t.x<(host.current?.clientWidth??0)-16&&t.y<(host.current?.clientHeight??0)-65).map(t=><button key={`${t.kind}/${t.id}`} type="button"
        className={cn("pointer-events-auto absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border text-lg shadow-[0_3px_8px_#40563630] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#234d35]",t.kind!=="meeple"?"border-[#75905a]/60 bg-[#e1e8c9]/85 text-[#4f6b3f] hover:bg-[#faf1ca]":"border-[#805f2d] bg-[#fff1c9] text-[#72572d] hover:bg-white",t.kind==="cluster"&&"size-9 rounded-full text-xs font-semibold",props.meeple===t.id&&"bg-[#ebcc78]")}
        style={{left:t.x,top:t.y}} aria-label={t.label} disabled={busy} data-carc-candidate={t.kind==="candidate"?t.id:undefined} data-carc-cluster={t.kind==="cluster"?t.count:undefined} data-meeple-target={t.kind==="meeple"?t.id:undefined}
        onClick={e=>{if(busy||e.detail!==0)return;if(t.kind==="candidate"&&t.placement){props.onInspect(null);props.onSelect(t.placement);if(frame.zoom<.65)arena.current?.focus(t.placement.x,t.placement.y);}else if(t.kind==="cluster"&&t.placement)arena.current?.focus(t.placement.x,t.placement.y);else if(t.kind==="meeple")props.onMeeple(t.id);}}>{t.kind==="cluster"?<span className="flex items-center gap-0.5"><Plus className="size-3"/>{t.count}</span>:<Plus className="size-4"/>}</button>)}
    </div>
    </div>
    {selected&&<span className="sr-only" data-carc-preview="true" data-valid={props.valid}>正在预览落点 {selected.x},{selected.y}</span>}
    <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
      <p className="max-w-[70%] rounded-lg bg-[#f6f0d9]/95 px-2.5 py-2 text-[11px] font-medium text-[#3d5637] shadow-[0_3px_10px_#566b4020]" aria-live="polite">{game.phase.kind==="finished"?"领地已完成 · 点地形查看归属":active?step==="tile"?"点空位拼接 · 单指拖动，双指缩放":"点标记派随从，或留待下回":`等待${game.players.find(p=>game.phase.kind==="turn"&&p.id===game.phase.playerId)?.name??"朋友"}落子`}</p>
      <Button variant="ghost" className="pointer-events-auto h-9 gap-1 rounded-lg bg-[#f6f0d9]/95 px-2 text-[11px] text-[#3d5637] shadow-sm hover:bg-[#fff4d1]" aria-expanded={regionsOpen} onClick={()=>setRegionsOpen(!regionsOpen)}><Map className="size-4"/>地形</Button>
    </div>
    {regionsOpen&&<div className="absolute top-14 right-3 left-3 z-10 max-h-[45%] overflow-y-auto rounded-xl bg-[#f6f0df] p-2 text-[#2e4b34] shadow-lg" role="region" aria-label="地形列表">
      <p className="px-2 py-1 text-xs text-[#5f6f4d]">选择区域，查看连接与归属</p>
      <div className="grid grid-cols-2 gap-1">{game.regions.map((r,i)=><Button key={r.id} variant="ghost" className="min-h-11 justify-start px-2 text-xs" aria-label={`查看${FEATURE_LABELS[r.kind]} ${i+1}`} data-feature-kind={r.kind}
        onFocus={()=>props.onInspect(r)} onClick={()=>{props.onInspect(r);const tile=game.board.find(t=>r.tileIds.includes(t.id));if(tile)arena.current?.focus(tile.x,tile.y);setRegionsOpen(false);}}>{FEATURE_LABELS[r.kind]} {i+1}<span className="ml-auto text-[#5f6f4d]">{r.tileIds.length} 块</span></Button>)}</div>
    </div>}
    {status==="loading"&&<div className="absolute inset-0 grid place-content-center gap-3 bg-[#c3d4b7] text-center text-sm text-[#3d5637]" role="status"><LoaderCircle className="mx-auto size-6 animate-spin motion-reduce:animate-none"/>正在搭建微缩领地…</div>}
    <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
      <div className="flex rounded-xl bg-[#f5efd9] p-1 shadow-[0_3px_12px_#40563630]">
        <Control label="查看全图" text="全图" onClick={()=>arena.current?.fit()}><Expand/></Control>
        <Control label={selected?"定位当前预览":"定位最新落子"} text={selected?"预览":"最新"} onClick={()=>{const t=selected??game.board.at(-1)!;arena.current?.focus(t.x,t.y);}}>{selected?<Focus/>:<MapPin/>}</Control>
        <Control label="旋转地图视角" text="转向" onClick={()=>arena.current?.rotate()}><Rotate3D/></Control>
        <Control label={frame.view==="top"?"恢复立体视角":"俯视地图"} text={frame.view==="top"?"立体":"俯视"} onClick={()=>arena.current?.top()}>{frame.view==="top"?<Mountain/>:<Layers/>}</Control>
      </div>
      <div className="flex rounded-xl bg-[#f5efd9] p-1 shadow-[0_3px_12px_#40563630]">
        <Control label="缩小地图" text="缩小" onClick={()=>arena.current?.zoom(.8)} disabled={frame.zoom<=.045}><Minus/></Control>
        <Control label="放大地图" text="放大" onClick={()=>arena.current?.zoom(1.25)} disabled={frame.zoom>=4.5}><Plus/></Control>
      </div>
    </div>
  </section>;
}
function Control({label,text,onClick,disabled,children}:{readonly label:string;readonly text:string;readonly onClick:()=>void;readonly disabled?:boolean;readonly children:React.ReactNode}){
  return <Button variant="ghost" className="carc-tool h-11 min-w-10 flex-col gap-0.5 rounded-lg px-1.5 py-1 text-[#34523f] hover:bg-[#dfdcc0] active:translate-y-px" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}<span className="text-[10px] leading-none">{text}</span></Button>;
}
