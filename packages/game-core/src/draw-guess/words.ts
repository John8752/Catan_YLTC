import { createSeededRandom, shuffledByIndex } from "../primitives/index.js";
import { REGIONAL_NOUNS, BIRTHDAY_NOUNS, EVERYDAY_NOUNS } from "./word-bank.js";

// Curated names and playful combinations; see docs/draw-guess-word-sources.md.
const childhoodCharacters = [
  "哆啦A梦", "皮卡丘", "蜡笔小新", "龙猫",
  "海绵宝宝", "派大星", "章鱼哥", "米老鼠", "唐老鸭", "史迪奇",
  "孙悟空", "哪吒", "葫芦娃", "黑猫警长", "喜羊羊", "灰太狼",
];
const subjects = ["熊猫", "企鹅", "小猫", "恐龙", "机器人", "小狗", "兔子", "蜗牛", "祥子", "静雯", "大鹏", "大靖", "丁丁", "踢踢", ...childhoodCharacters];
const actions = [
  "吃西瓜", "吹泡泡", "放风筝", "踢足球", "打雨伞", "钓鱼", "睡觉", "堆雪人", "潜水", "做饭", "抠脚", "偷看", "大笑",
  "刷牙", "洗脸", "洗澡", "喝水", "吃面", "吃冰淇淋", "吃棒棒糖",
  "扫地", "拖地", "浇花", "看书", "画画", "拍照", "打电话", "唱歌",
  "打鼓", "打篮球", "举哑铃", "跳绳", "荡秋千",
];
export function wordSuggestions(seed: number, count: number, excluded: readonly string[] = []): readonly (readonly string[])[] {
  const random = createSeededRandom(seed);
  const shuffle = <T>(items: readonly T[]) => shuffledByIndex(items, (upperExclusive) => Math.floor(random.next() * upperExclusive));
  const blocked = new Set(excluded);
  const available = (items: readonly string[]) => shuffle(items.filter((word) => !blocked.has(word)));
  const regions = available(Object.values(REGIONAL_NOUNS).flat());
  const birthday = available(BIRTHDAY_NOUNS), everyday = available(EVERYDAY_NOUNS);
  const phrases = available(subjects.flatMap((subject) => actions.map((action) => subject + action)));
  return Array.from({ length: count }, (_, i) => shuffle([
    regions[i]!, birthday[i]!, everyday[i]!, ...phrases.slice(i * 3, i * 3 + 3),
  ]));
}
