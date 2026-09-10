import { createSeededRandom, shuffledByIndex } from "../primitives/index.js";
import { REGIONAL_NOUNS, BIRTHDAY_NOUNS, EVERYDAY_NOUNS } from "./word-bank.js";

// Original prompts. Deliberately drawable combinations rather than a licensed word list.
const subjects = ["熊猫", "企鹅", "宇航员", "小猫", "恐龙", "机器人", "章鱼", "小狗", "兔子", "蜗牛", "狮子", "松鼠"];
const actions = ["骑自行车", "吃火锅", "修水管", "吹泡泡", "放风筝", "洗袜子", "坐过山车", "弹钢琴", "送外卖", "跳芭蕾", "煮面条", "堆雪人"];
export function wordSuggestions(seed: number, count: number): readonly (readonly string[])[] {
  const random = createSeededRandom(seed);
  const shuffle = <T>(items: readonly T[]) => shuffledByIndex(items, (upperExclusive) => Math.floor(random.next() * upperExclusive));
  const regions = shuffle(Object.values(REGIONAL_NOUNS).map((words) => shuffle<string>(words)));
  const birthday = shuffle(BIRTHDAY_NOUNS), everyday = shuffle(EVERYDAY_NOUNS);
  const phrases = shuffle(subjects.flatMap((subject) => actions.map((action) => subject + action)));
  return Array.from({ length: count }, (_, i) => shuffle([
    ...Array.from({ length: 3 }, (_, j) => { const index = i * 3 + j; return regions[index % regions.length]![Math.floor(index / regions.length)]!; }),
    birthday[i]!, everyday[i]!, phrases[i]!,
  ]));
}
