import { useLayoutEffect, useRef, useState } from "react";
import type { PageContent } from "@catan/game-core/draw-guess";
import { DrawingPreview } from "./DrawingCanvas.js";

export function GuessPicture({ content }: { readonly content: PageContent }) {
  const space = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = space.current!;
    const measure = () => setWidth(Math.max(0, Math.min(element.clientWidth, element.clientHeight * 4 / 3)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={space} className="flex min-h-0 flex-1 justify-center overflow-hidden">
    {content.kind === "drawing" || content.kind === "opening"
      ? <div className="shrink-0" style={{ width }}><DrawingPreview strokes={content.strokes} background={content.background} /></div>
      : <p className="self-center rounded-xl bg-amber-50 p-3 text-center text-sm text-slate-700">这一页没赶上交稿，凭想象继续吧。</p>}
  </div>;
}
