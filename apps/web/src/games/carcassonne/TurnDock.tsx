import { ArrowLeft, Check, ChevronRight, RotateCw, Footprints, LoaderCircle } from "lucide-react";
import { tileDefinition } from "@catan/game-core/carcassonne";
import type { CarcassonneView, LegalPlacement } from "@catan/protocol/carcassonne";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { TileArt, MeepleArt, FEATURE_LABELS } from "./TileArt.js";
import { PLAYER_SVG_COLORS } from "../../lib/player-palette.js";

export function TurnDock({game,selected,rotation,step,meeple,busy,offline,valid,retrying,onRotate,onContinue,onBack,onMeeple,onSubmit}:{
  readonly game:CarcassonneView;readonly selected:LegalPlacement|null;readonly rotation:number;readonly step:'tile'|'meeple';readonly meeple:string|null;
  readonly busy:boolean;readonly offline:boolean;readonly valid:boolean;readonly retrying:boolean;
  readonly onRotate:()=>void;readonly onContinue:()=>void;readonly onBack:()=>void;readonly onMeeple:(id:string|null)=>void;readonly onSubmit:()=>void;
}) {
  const own=game.players.find((p)=>p.id===game.you.id)!,active=game.phase.kind==='turn'&&game.phase.playerId===game.you.id;
  const options=selected?.meepleOptions??[];
  return <section className="shrink-0 rounded-2xl bg-[#f4ecd8] p-3 text-[#2b4635] shadow-[0_6px_20px_#0d261e40] lg:p-5" aria-label="本回合操作" data-carc-dock="true">
    <div className="flex items-center gap-3">
      <svg className="size-[76px] shrink-0 overflow-visible rounded-lg shadow-[3px_5px_7px_#52633d40] lg:size-[112px]" viewBox="-2 -2 104 106" role="img" aria-label={`当前板块 ${game.currentTile??'已用完'}`}>
        {game.currentTile&&<TileArt type={game.currentTile} rotation={rotation}/>}
      </svg>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-[#2b4635] lg:text-lg" aria-live="polite">{active?step==='tile'?'轮到你，接上这片风景':'派一名随从，或留待下回':`${game.players.find((p)=>game.phase.kind==='turn'&&p.id===game.phase.playerId)?.name??'朋友'}正在落子`}</h2>
        <p className="mt-1 text-caption leading-relaxed text-[#697052]">{active?step==='tile'?selected?valid?'相邻边已匹配，可以继续。':'这个朝向接不上，试试旋转。':'点地图上的虚线空位，再调整朝向。':options.length?'农夫会留到终局，其他随从完成区域后收回。':own.availableMeeples===0?'随从已全部派出，本回合只放板块。':'可选区域已被占领，本回合不放随从。':'可以拖动地图，点击地形查看连接与归属。'}</p>
      </div>
    </div>
    {active&&<>
      {step==='meeple'&&<div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="随从选择">
        <Button variant="outline" className={cn("min-h-11 flex-1 px-3 text-xs",meeple===null&&"border-[#3a6750] bg-[#dce7d5] text-[#284d38]")} aria-pressed={meeple===null} onClick={()=>onMeeple(null)} disabled={busy}><Footprints className="size-4"/>不放随从</Button>
        {options.map((id,i)=>{const f=tileDefinition(game.currentTile!).features.find((f)=>f.id===id)!;return <Button key={id} variant="outline" className={cn("min-h-11 gap-1.5 px-2 text-xs",meeple===id&&"border-[#3a6750] bg-[#dce7d5] text-[#284d38]")} aria-label={`选择${FEATURE_LABELS[f.kind]} ${id}`} aria-pressed={meeple===id} disabled={busy} onClick={()=>onMeeple(id)}>
          <svg className="size-6 overflow-visible" viewBox="-16 -17 32 34" aria-hidden="true"><MeepleArt color={PLAYER_SVG_COLORS[own.color]} farmer={f.kind==='field'}/></svg>{FEATURE_LABELS[f.kind]}{options.filter((other)=>other[0]===id[0]).length>1?String.fromCharCode(65+i):''}
        </Button>;})}
      </div>}
      <div className="mt-3 flex gap-2">
        {step==='tile'?<><Button variant="outline" className="min-h-11 gap-2 px-4" aria-label="旋转板块" disabled={busy} onClick={onRotate}><RotateCw className="text-[#8d613b]"/>旋转</Button><Button className="min-h-11 flex-1 gap-2 bg-[#335e43] text-[#fff6dc] shadow-[0_4px_10px_#254a3340] hover:bg-[#294e37] active:translate-y-px" disabled={!selected||!valid||busy} onClick={onContinue}>放在这里<ChevronRight/></Button></>
        :<><Button variant="outline" className="min-h-11 px-3" onClick={onBack} disabled={busy}><ArrowLeft/>返回</Button><Button className="min-h-11 flex-1 bg-[#335e43] text-[#fff6dc] shadow-[0_4px_10px_#254a3340] hover:bg-[#294e37] active:translate-y-px" onClick={onSubmit} disabled={busy||offline}>{busy?<LoaderCircle className="animate-spin motion-reduce:animate-none"/>:<Check/>}{busy?'正在落桌…':retrying?'重试提交':'完成回合'}</Button></>}
      </div>
      {offline&&<p className="mt-2 text-xs text-[#8b4d31]" role="status">连接恢复后可以提交，当前预览会保留。</p>}
    </>}
  </section>;
}
