import { useLayoutEffect, useState, type CSSProperties } from "react";

interface Bounds { width: number; height: number; top: number; left: number }

// iOS moves/shrinks the visual viewport for its keyboard while the layout
// viewport (and ordinary fixed/dvh elements) can remain behind the keyboard.
export function useGuessViewport(enabled: boolean) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  useLayoutEffect(() => {
    if (!enabled) { setBounds(null); return; }
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      // Leave intentional pinch magnification to the browser.
      if (viewport && Math.abs(viewport.scale - 1) > .01) return;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const layoutWidth = document.documentElement.clientWidth;
      // Safari may retain the previous pan offset briefly after dismissal.
      const top = Math.max(0, Math.min(viewport?.offsetTop ?? 0, layoutHeight - height));
      const left = Math.max(0, Math.min(viewport?.offsetLeft ?? 0, layoutWidth - width));
      setBounds((old) => old && old.width === width && old.height === height && old.top === top && old.left === left ? old : { width, height, top, left });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);
  const style: CSSProperties | undefined = enabled && bounds ? { position: "fixed", ...bounds } : undefined;
  return { style, compact: enabled && !!bounds && bounds.height < 520 };
}
