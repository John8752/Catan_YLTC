import type { Album, DrawPlayer } from "@catan/game-core/draw-guess";

export const REVEAL_INTRO_MS = 2_000;
export const REVEAL_INTERVAL_MS = 4_000;
const normalize = (text: string) => text.replace(/[\s\p{P}]/gu, "").toLocaleLowerCase("zh-CN");
const detours = ["这条接力开始自由发挥了，脑洞请系好安全带！", "画风越来越自由，想象力已经拦不住了。", "词语拐了个弯，快乐倒是一点没少。"];
const matches = ["稳稳接住！这次猜词和前面的词对上了。", "默契在线，这一棒传得漂亮！", "对上暗号了，下一位继续接！"];

/** Receives only the revealed prefix, so commentary cannot spoil later pages. */
export function narrateReveal(albums: readonly Album[], players: readonly DrawPlayer[], totalSteps: number, finished: boolean): string {
  if (finished) return "本场脑洞接力圆满收工！画册已经全部打开，挑一本回味名场面吧。";
  const album = albums.at(-1), page = album?.pages.at(-1);
  if (!album || !page) return "系统主持人：画册来了，看看谁的脑洞最离谱！";
  const name = players.find((player) => player.id === page.authorId)?.name ?? "朋友";
  if (page.content.kind === "missing") return `${name} 这一页没赶上，留白也是一种神秘的艺术。`;
  const original = album.pages[0]?.content;
  const guesses = album.pages.filter((entry) => entry.content.kind === "text");
  const clean = original?.kind === "opening" && album.pages.every((entry) => entry.content.kind !== "missing")
    && guesses.every((entry) => entry.content.kind === "text" && normalize(entry.content.text) === normalize(original.word));
  if (album.pages.length === totalSteps && clean && guesses.length > 0) return "真厉害，一路都对！这本画册的猜词全都接住了原词。";
  if (page.content.kind === "opening") return `${name} 选了「${page.content.word}」，还亲自画了第一张。来看看下一位能不能接住！`;
  if (page.content.kind === "drawing") return `${name} 把收到的词画出来了。画笔已交卷，脑洞请接力！`;
  const prior = album.pages.slice(0, -1).filter((entry) => entry.content.kind === "text" || entry.content.kind === "opening");
  const previous = prior.at(-1)?.content;
  const previousWord = previous?.kind === "text" ? previous.text : previous?.kind === "opening" ? previous.word : null;
  if (previousWord !== null && normalize(page.content.text) === normalize(previousWord)) return `${name}，${matches[page.step % matches.length]}`;
  const priorClean = original?.kind === "opening" && album.pages.slice(0, -1).every((entry) => entry.content.kind !== "missing"
    && (entry.content.kind !== "text" || normalize(entry.content.text) === normalize(original.word)));
  if (priorClean) return `${name}，哈哈哈，前面都对了，到你这楼歪了！猜词和原词不一样了。`;
  return `${name}，${detours[page.step % detours.length]}`;
}
