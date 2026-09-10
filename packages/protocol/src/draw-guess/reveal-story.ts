import type { AlbumPage } from "@catan/game-core/draw-guess";

/** The caller supplies only this album's already-revealed prefix. */
export function playerPerspective(pages: readonly AlbumPage[]): string {
  const content = pages.at(-1)?.content, preceding = pages.at(-2)?.content;
  if (!content || content.kind === "missing") return "这一棒我没赶上交稿，给大家留了个空白。";
  if (content.kind === "opening") return `我的题目是「${content.word}」，我先画给大家看。`;
  if (content.kind === "text") return `${preceding?.kind === "missing" ? "上一位没留下画，我猜的是" : "看了上一位的画，我猜的是"}「${content.text}」。`;
  if (preceding?.kind === "text") return `我要画的是「${preceding.text}」，我是这样画的。`;
  return "上一位没留下词语，我凭想象画了这张。";
}
