import { useEffect, useRef, useState } from "react";
import { Expand, Focus, MapPin, Minus, Plus } from "lucide-react";
import { featureRef, type PlacedTile, type Region } from "@catan/game-core/carcassonne";
import type { CarcassonneView, LegalPlacement } from "@catan/protocol/carcassonne";
import { Button } from "../../components/ui/button.js";
import { PLAYER_SVG_COLORS } from "../../lib/player-palette.js";
import { cn } from "../../lib/utils.js";
import { TileArt, MeepleArt, featureAnchor } from "./TileArt.js";
import { useMapCamera } from "./use-map-camera.js";

export function FlatCarcassonneBoard({game, selected, rotation, meeple, step, busy, valid, inspected, onSelect, onInspect, onMeeple}: {
  readonly game:CarcassonneView; readonly selected:LegalPlacement|null; readonly rotation:number; readonly meeple:string|null;
  readonly step:"tile"|"meeple"; readonly busy:boolean; readonly valid:boolean; readonly inspected:Region|null;
  readonly onSelect:(p:LegalPlacement)=>void; readonly onInspect:(r:Region|null)=>void; readonly onMeeple:(id:string)=>void;
}) {
  const camera=useMapCamera(), initial=useRef(true), initialBoard=useRef(game.board), observed=useRef(game.board.length);
  const [arrived,setArrived]=useState<string|null>(null);
  // A fresh mount opens the existing map without replaying past moves or scores.
  const boardRef=useRef<HTMLDivElement>(null);
  const active=game.phase.kind==='turn'&&game.phase.playerId===game.you.id;
  const cells=[...new Map(game.placements.map((p)=>[`${p.x},${p.y}`,p])).values()];
  const preview=selected&&game.currentTile?{id:`${selected.x},${selected.y}`,type:game.currentTile,x:selected.x,y:selected.y,rotation}:null;
  const own=game.players.find((p)=>p.id===game.you.id)!;
  useEffect(()=>{if(initial.current&&camera.bounds.measured){initial.current=false;if(initialBoard.current.length>1)camera.fit(initialBoard.current);}},[camera.bounds.width,camera.bounds.height,camera.bounds.measured]);
  useEffect(()=>{if(observed.current===game.board.length)return;observed.current=game.board.length;setArrived(game.board.at(-1)?.id??null);const timer=setTimeout(()=>setArrived(null),500);return()=>clearTimeout(timer);},[game.board.length]);
  function tileSelect(p:LegalPlacement) { if (busy) return; onInspect(null); onSelect(p); if (camera.camera.size<60) camera.focus(p.x,p.y); }
  return <div ref={boardRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#173d35] shadow-[inset_0_4px_24px_#0b241c80] lg:rounded-3xl" data-carc-map="true">
    <div ref={camera.stage} className="absolute inset-0" role="region" aria-label="可移动的卡卡颂地图">
      <svg className="carc-map-svg h-full w-full touch-none select-none" role="group" aria-label="卡卡颂地图，拖动浏览，双指缩放" tabIndex={0}
        data-camera-size={camera.camera.size} data-camera-x={camera.camera.x} data-camera-y={camera.camera.y} data-moving={camera.moving||undefined}
        viewBox={`0 0 ${camera.bounds.width} ${camera.bounds.height}`} {...camera.svgProps}>
        <defs><pattern id="carc-table-pattern" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#d2dfb3" strokeOpacity=".07" strokeWidth=".5"/><circle cx="0" cy="0" r="1.6" fill="#d2dfb3" fillOpacity=".16"/></pattern></defs>
        <g transform={camera.transform} className={cn("carc-camera",camera.moving&&"carc-camera-moving")}>
          <rect x="-9000" y="-9000" width="18000" height="18000" fill="url(#carc-table-pattern)" onClick={()=>onInspect(null)}/>
          {game.board.map((tile)=><BoardTile key={tile.id} tile={tile} game={game} inspected={inspected} arrived={arrived===tile.id} onInspect={onInspect}/>)}
          {active&&step==='tile'&&cells.map((cell)=>{
            const match=game.placements.find((p)=>p.x===cell.x&&p.y===cell.y&&p.rotation===rotation)??cell;
            if(preview?.x===cell.x&&preview.y===cell.y)return null;
            return <g key={`${cell.x},${cell.y}`} role="button" tabIndex={busy?-1:0} aria-disabled={busy} aria-label={`落点 ${cell.x},${cell.y}`} data-carc-candidate="true"
              transform={`translate(${cell.x*100} ${cell.y*100})`} onClick={()=>tileSelect(match)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tileSelect(match);}}}>
              <rect x="4" y="4" width="92" height="92" rx="8" fill="#d4dba3" fillOpacity=".07" stroke="#c7d793" strokeOpacity=".48" strokeWidth="1.8" strokeDasharray="5 6"/>
              <path d="M42 50H58M50 42V58" stroke="#d5e0ab" strokeWidth="2" strokeLinecap="round"/>
            </g>;
          })}
          {preview&&<g key={preview.id} className="carc-preview" transform={`translate(${preview.x*100} ${preview.y*100})`} data-carc-preview="true" data-valid={valid}>
            <rect x="-3" y="-3" width="106" height="106" rx="5" fill={valid?"#edcf76":"#dd7964"} opacity=".9"/>
            <TileArt type={preview.type} rotation={rotation} selectedFeatures={meeple?[meeple]:[]}/>
            {step==='meeple'&&selected?.meepleOptions.map((id)=>{const a=featureAnchor(preview.type,id,rotation);return <g key={id} transform={`translate(${a.x} ${a.y})`} role="button" tabIndex={busy?-1:0} aria-label={`在预览板块放置随从 ${id}`} data-meeple-target={id}
              onClick={()=>!busy&&onMeeple(id)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!busy)onMeeple(id);}}}>
              <circle r="14" fill="#fff4cf" fillOpacity=".85" stroke="#8c652b" strokeWidth="1.5"/>
              {meeple===id?<MeepleArt color={PLAYER_SVG_COLORS[own.color]} farmer={id.startsWith('f')} selected/>:<path d="M-5 0H5M0-5V5" stroke="#6e562c" strokeWidth="2"/>}
            </g>;})}
          </g>}
        </g>
      </svg>
    </div>
    <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-[#102f27]/90 px-3 py-2 text-xs text-[#e7e8c7] shadow-md" aria-live="polite">
      {game.phase.kind==='finished'?'全局已结算 · 点击地形查看归属':active?step==='tile'?'选择虚线空位，预览拼接':'选择随从位置，或选择不放':`等待${game.players.find((p)=>game.phase.kind==='turn'&&p.id===game.phase.playerId)?.name??'朋友'}落子`}
    </div>
    <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
      <div className="flex rounded-xl bg-[#f4ecd8] p-1 shadow-[0_3px_12px_#08241f55]">
        <MapControl label="查看全图" text="全图" onClick={()=>camera.fit(preview?[...game.board,preview]:game.board)}><Expand/></MapControl>
        <MapControl label="定位当前预览" text="预览" disabled={!preview} onClick={()=>preview&&camera.focus(preview.x,preview.y)}><Focus/></MapControl>
        <MapControl label="定位最新落子" text="最新" onClick={()=>{const t=game.board.at(-1)!;camera.focus(t.x,t.y);}}><MapPin/></MapControl>
      </div>
      <div className="flex rounded-xl bg-[#f4ecd8] p-1 shadow-[0_3px_12px_#08241f55]">
        <MapControl label="缩小地图" text="缩小" disabled={camera.camera.size<=2} onClick={()=>camera.zoom(.8)}><Minus/></MapControl>
        <MapControl label="放大地图" text="放大" disabled={camera.camera.size>=160} onClick={()=>camera.zoom(1.25)}><Plus/></MapControl>
      </div>
    </div>
  </div>;
}
function MapControl({label,text,onClick,disabled,children}:{readonly label:string;readonly text:string;readonly onClick:()=>void;readonly disabled?:boolean;readonly children:React.ReactNode}) {
  return <Button variant="ghost" className="carc-tool h-12 min-w-11 flex-col gap-0.5 rounded-lg px-2 py-1 text-[#34523f] hover:bg-[#dfdcc0] active:translate-y-px" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}<span className="text-[10px] leading-none">{text}</span></Button>;
}
function BoardTile({tile,game,inspected,arrived,onInspect}:{readonly tile:PlacedTile;readonly game:CarcassonneView;readonly inspected:Region|null;readonly arrived:boolean;readonly onInspect:(r:Region|null)=>void}) {
  const highlightedRefs=inspected?[...inspected.refs,...game.regions.filter((r)=>inspected.completedCityIds.includes(r.id)).flatMap((r)=>r.refs)]:[];
  const selectedFeatures=highlightedRefs.filter((ref)=>ref.startsWith(`${tile.id}/`)).map((ref)=>ref.split('/')[1]!);
  return <g transform={`translate(${tile.x*100} ${tile.y*100})`} data-carc-tile={tile.id}>
    <g className={arrived?'carc-tile-arrived':undefined}>
      <TileArt type={tile.type} rotation={tile.rotation} selectedFeatures={selectedFeatures} onFeature={(id)=>onInspect(game.regions.find((g)=>g.refs.includes(featureRef(tile.id,id)))??null)}/>
      {game.meeples.filter((m)=>m.tileId===tile.id).map((m)=>{const a=featureAnchor(tile.type,m.featureId,tile.rotation),player=game.players.find((p)=>p.id===m.playerId)!;return <g key={m.featureId} transform={`translate(${a.x} ${a.y})`} pointerEvents="none"><MeepleArt color={PLAYER_SVG_COLORS[player.color]} farmer={m.featureId.startsWith('f')} label={`${player.name}的${m.featureId.startsWith('f')?'农夫':'随从'}`}/></g>;})}
    </g>
  </g>;
}
