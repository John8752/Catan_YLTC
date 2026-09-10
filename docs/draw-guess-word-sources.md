# Draw-guess word-bank research

Researched 2026-09-10; simplified and personalized after player feedback on the same date. The current bank contains 96 curated nouns (28 regional-theme associations, 12 birthday, 56 everyday) plus 990 subject/action combinations (30 subjects × 33 actions), totaling 1,086 prompts. The six personal names and five personalized actions were supplied by the user; a further 20 familiar actions were selected for recognizable poses or simple props. Sixteen animation characters add the requested childhood-nostalgia theme. Personal-name combinations do not infer anyone's biography. Six choices are dealt without replacement: three playful phrases, one regional-theme noun, one birthday noun and one everyday noun. Seeded shuffling preserves replay determinism. Regions are internal editorial groups, not extra clues sent to guessers.

## Emoji-inspired everyday additions

The user suggested selecting recognizable emoji subjects and explicitly requested 虾, with 煎蛋 already in the bank. Twenty-four nouns were selected from familiar animal/food shapes in the [Unicode emoji list](https://unicode.org/emoji/charts/emoji-list.html) and [full emoji chart](https://unicode.org/emoji/charts/full-emoji-list.html), checked 2026-09-10. Examples include 🦐 虾、🦀 螃蟹、🍇 葡萄、🥕 胡萝卜、🍔 汉堡、🍕 披萨、🍩 甜甜圈. The Chinese words are editorial labels; this is not a claim that an emoji guarantees an easy drawing. Only text is added to the everyday pool, with no emoji-image dependency, answer illustration or changed dealing weight.

## Childhood-character selection

The group described themselves as born around 1995 and requested distinctive childhood-animation characters. The 16-name selection is an editorial fit for their request, not a claim that everyone of that age watched every series. It favors silhouettes and props such as a square sponge, starfish, round mouse ears, a gourd, a staff or a police cap. Names combine with the existing simple actions, e.g. 皮卡丘刷牙、派大星抠脚、哪吒跳绳. The game stores prompt text, with no bundled character art or media.

Reference pages checked on 2026-09-10: [CCTV 动画城](https://news.cctv.com/program/dhc/03/index.shtml), [CCTV 海绵宝宝](https://donghua.cctv.com/special/hmbb/shouye/), [CCTV 2013 animation programming](https://shaoer.cntv.cn/special/2013gq/index.shtml), [official Pokémon Chinese Pokédex: 皮卡丘](https://pokedex.pokemon.cn/play/pokedex/0025), [TV Asahi Doraemon characters](https://www.tv-asahi.co.jp/doraemon/character/), [Studio Ghibli works](https://www.ghibli.jp/works/?OpBrower=1). These support character/series identity and animation context; perceived recognizability remains an editorial judgment.

## Initial regional research

The source table below records the initial research, not the current playable inventory. Exact landmarks and obscure local food names were removed in favor of familiar objects: 西湖绸伞 → 雨伞, 盖碗茶 → 茶杯, 长江索道 → 缆车, 秋千长椅 → 秋千. New generic motifs such as lanterns, kites, shells and monkeys are editorial choices, not sourced claims of regional exclusivity. Avoid requiring written labels, regional trivia or subtle differences between nearly identical objects. Difficult or crowded actions such as repairing pipes, riding a roller coaster and playing piano were replaced with one-action scenes such as blowing bubbles, fishing and sleeping. The source of truth for actual words is `packages/game-core/src/draw-guess/word-bank.ts` and `words.ts`.

These pages supported the initial regional associations and object selection. We use short factual names, not their prose, illustrations or a licensed game's word list. The initial bank included Chinese translations such as 重逢塔 (Reunion Tower) and 巧克力山 (Chocolate Hills); both have been removed from the simplified bank.

| Theme | Sources and examples |
| --- | --- |
| 杭州 | [杭州文旅：雷峰塔](https://wgly.hangzhou.gov.cn/art/2022/12/1/art_1229696389_58943150.html), [杭州市政府：西湖游船](https://www.hangzhou.gov.cn/art/2022/5/7/art_812268_59055194.html), [中国非遗：西湖绸伞](https://www.ihchina.cn/project_details/14578.html). 西湖、雷峰塔、断桥、龙井茶、绸伞、游船。 |
| 北京 | [北京市政府：天坛](https://english.beijing.gov.cn/travellinginbeijing/parks/202603/t20260320_4562532.html), [故宫与烤鸭](https://nyncj.beijing.gov.cn/nyj/zwgk/ztgk/dssjzgbjzydh/dhdt/436221748/index.html), [北京旅游网：天坛附近美食](https://www.visitbeijing.com.cn/article/4MyNvVPbKlv). 天坛、故宫、烤鸭、铜火锅、豆汁、焦圈。 |
| 成都 | [红星新闻网：川渝文旅线路](https://news.chengdu.cn/2026/0102/695716e9b66787578bb7e38e.shtml), [川渝双城行程](https://www.cqwander.cn/guide/chengdu-chongqing-itinerary). 熊猫、盖碗茶、川剧脸谱、担担面、串串香；竹椅与竹子是茶馆/熊猫主题的日常联想。 |
| 达拉斯 | [Visit Dallas：West End](https://www.visitdallas.com/neighborhoods/west-end/), [Reunion Tower 官方](https://reuniontower.com/). 牛仔帽、牛仔靴、牛排、重逢塔；旅游页面也介绍乒乓球区、秋千长椅、望远镜与观景台。 |
| 菲律宾 | [菲律宾旅游部：Bohol](https://www.tourism.gov.ph/destination/central-visayas/bohol/), [Travel Philippines：Bohol](https://app.philippines.travel/articles/intro-to-bohol), [菲律宾旅游推广署海岛行程](https://www.tpb.gov.ph/wp-content/uploads/2019/06/RFQ2019-06-555-Itinerary.pdf). 眼镜猴、巧克力山、海滩、海豚、海龟；珊瑚、潜水镜、螃蟹船为海岛活动的绘画联想。 |
| 重庆 | [红星新闻网：川渝文旅线路](https://news.chengdu.cn/2026/0102/695716e9b66787578bb7e38e.shtml), [洪崖洞吊脚楼风貌](https://www.holidayasia.net/wp-content/uploads/2025/08/CYB.pdf). 洪崖洞、长江索道、轻轨、吊脚楼、火锅、解放碑、大扶梯。 |
| 贵阳 | [贵阳旅游行程](https://guizhoutour.com/407.html), [澎湃：贵阳丝娃娃](https://m.thepaper.cn/newsDetail_forward_3020396). 甲秀楼、黔灵山、青岩古镇、丝娃娃、肠旺面、酸汤鱼、米豆腐、烙锅。 |
| 生日、日常 | [Target：生日用品分类](https://www.target.com/c/birthday-party-supplies/birthday/-/N-5xt37Z5zl0t), [Hallmark：生日用品](https://www.hallmark.com/birthday/birthday-party-supplies/). 蛋糕、蜡烛、气球、帽子、纸杯与纸盘作为参考；长寿面、寿桃及日常家居、文具、出行名词由项目自行编选。 |

Prefer recognizable nouns that can be drawn in a short round. No proper name implies a licensed partnership. Additional themed terms should retain category balance, uniqueness, bounded length and deterministic tests.
