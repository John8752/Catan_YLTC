import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type MouseEvent } from "react";
import type { PlacedTile } from "@catan/game-core/carcassonne";
export interface Camera { readonly x: number; readonly y: number; readonly size: number }
const clamp = (n: number) => Math.max(2, Math.min(160, n));
export function fitCamera(board: readonly PlacedTile[], width: number, height: number): Camera {
  const left = Math.min(...board.map((t) => t.x)), right = Math.max(...board.map((t) => t.x)) + 1;
  const top = Math.min(...board.map((t) => t.y)), bottom = Math.max(...board.map((t) => t.y)) + 1;
  return { x: (left+right)*50, y: (top+bottom)*50, size: Math.max(2, Math.min(88, (width-48)/(right-left+1.2), (height-64)/(bottom-top+1.2))) };
}
export function useMapCamera() {
  const stage = useRef<HTMLDivElement>(null), points = useRef(new Map<number,{ x: number; y: number }>());
  const origin = useRef<{ x: number; y: number } | null>(null), suppressed = useRef(false), release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 50, y: 50, size: 72 });
  const cameraRef = useRef(camera); cameraRef.current = camera;
  const [bounds, setBounds] = useState({ width: 393, height: 500, measured: false }), [moving, setMoving] = useState(false);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setBounds({ width: entry.contentRect.width, height: entry.contentRect.height, measured: true }); });
    observer.observe(stage.current);
    return () => { observer.disconnect(); if (release.current) clearTimeout(release.current); };
  }, []);
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (release.current) clearTimeout(release.current);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size === 1) { origin.current = { x: e.clientX, y: e.clientY }; suppressed.current = false; }
    else { suppressed.current = true; setMoving(true); e.currentTarget.setPointerCapture(e.pointerId); }
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const previous = points.current.get(e.pointerId); if (!previous) return;
    const before = [...points.current.values()]; points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = [...points.current.values()], current = cameraRef.current;
    if (after.length >= 2) {
      const [a,b] = before, [c,d] = after; if (!a || !b || !c || !d) return;
      const distance = Math.max(1, Math.hypot(a.x-b.x,a.y-b.y)), nextDistance = Math.hypot(c.x-d.x,c.y-d.y);
      const size = clamp(current.size*nextDistance/distance), rect = e.currentTarget.getBoundingClientRect();
      const bx=(a.x+b.x)/2-rect.left-bounds.width/2, by=(a.y+b.y)/2-rect.top-bounds.height/2;
      const ax=(c.x+d.x)/2-rect.left-bounds.width/2, ay=(c.y+d.y)/2-rect.top-bounds.height/2;
      const next={ size, x:current.x+bx*100/current.size-ax*100/size, y:current.y+by*100/current.size-ay*100/size };
      cameraRef.current=next; setCamera(next); suppressed.current=true; setMoving(true);
    } else if (origin.current && (suppressed.current || Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>5)) {
      suppressed.current=true; setMoving(true); e.currentTarget.setPointerCapture(e.pointerId);
      const next={ ...current, x:current.x-(e.clientX-previous.x)*100/current.size, y:current.y-(e.clientY-previous.y)*100/current.size };
      cameraRef.current=next; setCamera(next);
    }
  };
  const endPointer = (e: PointerEvent<SVGSVGElement>) => {
    if(e.type==='pointercancel')suppressed.current=true;
    points.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (points.current.size === 0) { setMoving(false); origin.current=null; release.current=setTimeout(() => { suppressed.current=false; },0); }
  };
  const focus = (x: number,y: number) => setCamera((c) => ({ x:x*100+50,y:y*100+50,size:Math.max(72,c.size) }));
  const onClickCapture = (e: MouseEvent<SVGSVGElement>) => { if (suppressed.current) { e.preventDefault(); e.stopPropagation(); } };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.target!==e.currentTarget) return;
    const deltas: Record<string,readonly [number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const d=deltas[e.key]; if (d) { e.preventDefault(); setCamera((c) => ({...c,x:c.x+d[0]*60,y:c.y+d[1]*60})); }
    if (e.key==='+'||e.key==='-') { e.preventDefault(); setCamera((c)=>({...c,size:clamp(c.size*(e.key==='+'?1.25:.8))})); }
  };
  return { stage, camera, moving, bounds, focus, fit:(board:readonly PlacedTile[])=>setCamera(fitCamera(board,bounds.width,bounds.height)),
    zoom:(factor:number)=>setCamera((c)=>({...c,size:clamp(c.size*factor)})),
    svgProps:{onPointerDown,onPointerMove,onPointerUp:endPointer,onPointerCancel:endPointer,onClickCapture,onKeyDown},
    transform:`translate(${bounds.width/2} ${bounds.height/2}) scale(${camera.size/100}) translate(${-camera.x} ${-camera.y})` };
}
