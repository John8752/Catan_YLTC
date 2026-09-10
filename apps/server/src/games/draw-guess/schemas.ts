import { z } from "zod";
import { DRAW_COLORS, DRAW_LIMITS, DRAW_WIDTHS } from "@catan/game-core/draw-guess";

const point = z.tuple([z.number().int().min(0).max(DRAW_LIMITS.width), z.number().int().min(0).max(DRAW_LIMITS.height)]);
const stroke = z.object({ color: z.enum(DRAW_COLORS), width: z.union(DRAW_WIDTHS.map((width) => z.literal(width))), points: z.array(point).min(1).max(DRAW_LIMITS.points) }).strict();
const page = z.discriminatedUnion("kind", [z.object({ kind: z.literal("text"), text: z.string().max(DRAW_LIMITS.text) }).strict(),
  z.object({ kind: z.literal("drawing"), strokes: z.array(stroke).max(DRAW_LIMITS.strokes) }).strict(),
  z.object({ kind: z.literal("opening"), word: z.string().max(DRAW_LIMITS.text), strokes: z.array(stroke).max(DRAW_LIMITS.strokes) }).strict()]);
const scope = { matchId: z.string().min(1).max(100), taskId: z.string().min(1).max(220) };
export const drawCommandSchema = z.object({ seatToken: z.string().min(1).max(100), commandId: z.string().min(1).max(100),
  command: z.discriminatedUnion("type", [
    z.object({ type: z.literal("draft"), ...scope, sequence: z.number().int().positive().safe(), page }).strict(),
    z.object({ type: z.literal("submit"), ...scope, page }).strict(),
  ]),
}).strict();
export const drawSettingsSchema = z.object({ seatToken: z.string().min(1), expectedRevision: z.number().int().positive(),
  textSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]), drawingSeconds: z.union([z.literal(60), z.literal(90), z.literal(120)]),
}).strict();
