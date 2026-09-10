import { DRAW_BACKGROUNDS, DRAW_LIMITS, type Stroke } from "@catan/game-core/draw-guess";

export function paint(context: CanvasRenderingContext2D, strokes: readonly Stroke[], background = DRAW_BACKGROUNDS[0] as string) {
  context.save();
  context.clearRect(0, 0, DRAW_LIMITS.width, DRAW_LIMITS.height);
  context.lineCap = "round"; context.lineJoin = "round";
  for (const stroke of strokes) {
    context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.width;
    const first = stroke.points[0]; if (!first) continue;
    if (stroke.points.length === 1) { context.beginPath(); context.arc(first[0], first[1], stroke.width / 2, 0, Math.PI * 2); context.fill(); continue; }
    context.beginPath(); context.moveTo(first[0], first[1]);
    for (const point of stroke.points.slice(1)) context.lineTo(point[0], point[1]);
    context.stroke();
  }
  // Fill behind the composited ink, so erased pixels always show the current background.
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = background; context.fillRect(0, 0, DRAW_LIMITS.width, DRAW_LIMITS.height);
  context.restore();
}
