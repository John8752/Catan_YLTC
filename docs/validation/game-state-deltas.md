# 三款游戏同步优化

2026-11-26。范围为 platform 的传输组合与确认层，camel-up、carcassonne、texas-holdem 的命令入口和网页消费者；卡卡颂另包含板块序列化及 Three.js 对象复用。规则、计分、随机结果、SQLite 结算语义未改变。设计见 [ADR-0019](../adr/0019-game-state-deltas.md)。

## 当前实现

- 三款游戏的命令始终返回 ACK，包含 commandId、gameId、roomId、matchId 和接受的 room/game revision；德扑另带手数。按用户要求，不保留三款游戏的旧完整命令响应、响应模式协商或旧客户端增量回退。网页和服务端使用同一版协议。
- 网页处理推送先到、ACK 先到、断线、迟到 HTTP、换座位和换 match。等待 1.5 秒仍未收到对应推送时，只补拉一次完整视图，不重发已接受的命令。
- 卡卡颂按 ID 更新/删除 board、regions、meeples、scores，保留列表顺序与未变对象引用。区域合并会删除旧区域。合法位置等当前字段按变化发送。
- 骆驼只发送变化的当前字段和带基线 revision 的日志 splice；截窗仍为 60 条，重复文字不会按文本去重。暗投仍先经过每个座位的安全投影。
- 德扑保留有界完整 WS 视图，只移除重复 HTTP 全量响应。effects 仍为当前转换，未引入整局历史累积。
- 每条 WS 连接有独立的编码/还原基线。首次进入、重连、回到大厅、新 match 都使用完整快照；版本断层或缺失基线触发重新连接。HTTP 恢复不修改 WS 解码器基线。
- 卡卡颂只保存和投影 id/type/x/y/rotation，去掉命令附带的 matchId/turn/meeple 等冗余。公开区域和活动玩家的合法选择按不可变核心状态缓存；返回值仍独立复制，调用方不能污染缓存或其他座位。
- 卡卡颂保留现有地块缓存，并按键保留随从与候选标记的几何、材质；只有新增、变化或删除的对象创建/释放资源。
- 卡坦已有地图/历史/效果逻辑和传画猜词的完整视图保持原有策略；共享 WS 入口明确分派各游戏。

## 同一状态的 JSON 对比

完整对局使用真实 RoomRegistry、每个座位的安全投影和生产编码器/解码器。逐座位、逐更新深比较还原视图与权威投影，一致后才计数。对照为相同状态的完整视图加完整 HTTP 响应，优化为当前 WS 编码加 ACK；两者均已包含板块字段清理，因此没有重复计入字段清理收益。

以下是所有座位合计的未压缩 UTF-8 JSON，不含初始快照、HTTP 头、WS 帧头，不等于实际流量。

| 游戏 | 对局 | 完整 WS / 增量 WS | 完整 HTTP / ACK | 合计 JSON 减少 |
| --- | --- | --- | --- | --- |
| 骆驼大赛 | 6 人，104 次行动 | 3,499,941 / 1,148,847 B | 574,268 / 17,056 B | 71.38% |
| 卡卡颂 | 5 人，71 次落子 | 6,031,491 / 937,092 B | 1,188,914 / 11,836 B | 86.86% |
| 德州扑克 | 9 人，100 手，3,699 次行动 | 154,901,108 / 154,901,108 B | 17,104,703 / 699,225 B | 9.54% |

卡卡颂固定 seed 42；德扑使用固定种子显式洗牌、低盲注/高筹码与跟注/过牌策略，以验证 100 手不会积累历史。骆驼使用生产随机骰子，同策略的局长可能变化。数字不是所有真人对局的保证。

## 实际压缩 WebSocket 对比

另启动独立本地 Fastify 服务和真实回环 TCP WebSocket，每个座位同时连接生产 `/ws` 和仅存在于外部测量脚本中的完整视图对照路由。两边接收同一权威局；协商 `permessage-deflate`。统计 Node socket.bytesRead 的操作前后差额，包含 WS 帧头，排除握手、初始快照、TCP/IP 头和 HTTP ACK。对照路由不进入产品，也不构成旧客户端兼容。

| 游戏 | 对局 | 完整 WS | 优化 WS | 变化 |
| --- | --- | ---: | ---: | ---: |
| 骆驼大赛 | 6 人，120 次行动 | 87,800 B | 60,959 B | 减少 30.57% |
| 卡卡颂 | 5 人，71 次落子 | 108,686 B | 66,143 B | 减少 39.14% |
| 德州扑克 | 9 人，100 手 | 3,814,555 B | 3,815,014 B | 基本不变，0.012% 时钟取样波动 |

德扑本轮收益在 HTTP ACK，不能用 JSON 合计下降比例宣称其 WS 流量下降。没有测生产代理、真实无线网络、真机 FPS 或主线程长任务，不能把字节下降转换成帧率改善比例。

外部测量产物位于 `C:/Users/Administrator/.codex/visualizations/2026/11/26/01a215bc-4281-7121-83ae-6414cea8a6c3/sync-review/`：`comparison.mts`、`comparison-results.json`、`wire-comparison.mts`、`wire-results.json`。均不含座位令牌或原始私密牌序。仓库中的协议整局测试与平台 WS/ACK 测试保留可重复的状态一致性验证。

## 验证

- `pnpm test:plan`：共享协议/服务端入口选中其各游戏 protocol/server/web 消费者；只有卡卡颂选中 core。没有执行其他游戏的 core 玩法回归或全游戏浏览器 gate。
- `pnpm validate`：类型检查通过；92 个受影响测试文件中 core 16、protocol 67、server 99、web 182 项通过，另有 8 项架构检查，共 372 项。
- 核心字段测试先复现旧板块携带额外命令属性的失败，再验证修正。协议整局覆盖两座位完整卡卡颂投影、增量重复、缺基线、断层、新 match、实体移除、对象引用；骆驼覆盖截窗和重复日志、暗投隐私。平台实际 WS handler 覆盖三游戏 ACK、重复请求与完整权威视图对比。网页确认层覆盖 ACK/推送顺序、漏推、迟到补拉、替换凭据和新 match。
- 浏览器使用独立 E2E 服务及内存 SQLite，Chromium。卡卡颂手机主力四个竖屏 CSS viewport：393×852、393×659、440×956、440×763，DPR 3；覆盖实际地图、随从预览、区域、后期长图、视角和安全区。骆驼与德扑使用同一主力矩阵；骆驼另有 iPhone 14 浏览器区域兼容。未进行 iOS Safari 或物理真机验证。
- `pnpm test:e2e:carcassonne:mobile --workers=1`：11 项通过；后续 ACK 简化仅调整相关提交夹具，复跑其提交/重试与真实多人、漏推恢复场景。
- `pnpm test:e2e:camel-up race.spec.ts --grep 'three seats|six-player portrait' --workers=1`：6 项通过，包含暗投、恢复、完整结算、重开、四主力手机及兼容尺寸。
- `pnpm test:e2e:texas-holdem play.spec.ts --workers=1`：两种真实多人模式和四手机用例共 6 项通过；2 项旧动效用例在首次挂载发牌断言失败。共享等待页在已有 HEAD 中就会于首份快照挂载牌桌，按现有游标约定该基线静默；改为明确检查首次静默，并在下一手实时推送检查发牌动画。单独复跑 `--grep 'accepted action motion'`，正常/减少动态 2 项通过，保留加注、弃牌、全下、收池和重连不重播检查。
- 初轮卡卡颂真实多人测试仍查找旧等待页标题；按现有共享等待页文字修正后通过，没有改变产品文案。
- 网页与服务端生产构建通过；最终 ACK 简化后再检查产物。既有 Three.js chunk 大于 500 KB 提示仍存在。

- `pnpm test:e2e:carcassonne play.spec.ts transport.spec.ts interactions.spec.ts --grep 'two isolated|ACK loss|invalid rotation' --workers=1`：最终 ACK 协议下 4 项通过，包含桌面/393×659 漏推补拉、WS 版本断层重连、保持镜头时的对象复用、幂等重试、两浏览器整局结算与重开。
- `pnpm test:e2e:catan room-transport.spec.ts incremental-history.spec.ts --workers=1`：5 项通过，验证共享入口下地图缓存、历史翻页/缺口、ACK 恢复及重连，桌面与 iPhone 16 浏览器区域。没有运行无关卡坦地图/规则全量回归。
- 最终执行 `pnpm --filter @catan/web build` 与 `pnpm --filter @catan/server build`，均通过；`pnpm test:inventory` 通过，新增测试各有唯一归属，`git diff --check` 无空白错误。
