import { shuffledByIndex } from "../primitives/index.js";

// Original prompts. Deliberately drawable combinations rather than a licensed word list.
const subjects = ["熊猫", "企鹅", "宇航员", "小猫", "恐龙", "机器人", "章鱼", "小狗", "兔子", "蜗牛", "狮子", "松鼠"];
const actions = ["骑自行车", "吃火锅", "修水管", "吹泡泡", "放风筝", "洗袜子", "坐过山车", "弹钢琴", "送外卖", "跳芭蕾", "煮面条", "堆雪人"];
export function wordSuggestions(seed: number, count: number): readonly (readonly string[])[] {
  let value = seed >>> 0;
  const next = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value; };
  const words = shuffledByIndex(subjects.flatMap((subject) => actions.map((action) => subject + action)), (upperExclusive) => next() % upperExclusive);
  return Array.from({ length: count }, (_, i) => words.slice(i * 6, i * 6 + 6));
}
