// Curated drawable nouns; references and regional/editorial boundaries:
// docs/draw-guess-word-sources.md. No copied commercial game word list.
export const REGIONAL_NOUNS = {
  hangzhou: ["雨伞", "小船", "荷花", "茶杯"],
  beijing: ["烤鸭", "糖葫芦", "灯笼", "风筝"],
  chengdu: ["熊猫", "竹子", "竹椅", "竹笋"],
  dallas: ["牛仔帽", "牛仔靴", "牛排", "秋千"],
  philippines: ["海龟", "海豚", "椰子", "贝壳"],
  chongqing: ["火锅", "缆车", "火车", "大桥"],
  guiyang: ["猴子", "小山", "辣椒", "面条"],
} as const;
export const BIRTHDAY_NOUNS = [
  "生日蛋糕", "蜡烛", "礼物盒", "生日帽", "气球", "蝴蝶结",
  "皇冠", "鲜花", "纸杯", "彩旗", "礼花筒", "草莓",
] as const;
export const EVERYDAY_NOUNS = [
  "牙刷", "毛巾", "拖鞋", "闹钟", "枕头", "衣架", "冰箱", "水壶",
  "筷子", "汤勺", "平底锅", "书包", "铅笔", "尺子", "台灯", "眼镜",
  "钥匙", "手机", "耳机", "镜子", "自行车", "红绿灯", "雨靴", "行李箱",
  "扫帚", "垃圾桶", "苹果", "香蕉", "面包", "煎蛋", "西瓜", "足球",
  // Simple emoji-inspired shapes; prompts remain plain text.
  "虾", "螃蟹", "章鱼", "鱼", "葡萄", "梨", "桃子", "樱桃",
  "柠檬", "橙子", "胡萝卜", "茄子", "黄瓜", "蘑菇", "汉堡", "披萨",
  "薯条", "热狗", "甜甜圈", "饼干", "糖果", "棒棒糖", "冰淇淋", "鸡腿",
] as const;
