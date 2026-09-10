# 多游戏路线图与实现边界

本计划区分大厅框架、卡坦和传画猜词。旧的 `first-playable-plan.md`、地图和交易方案仍是卡坦历史记录，不是新游戏必须继承的模型。

## 本次里程碑

| 范围 | 交付 | 主要入口 |
| --- | --- | --- |
| 大厅框架 / platform | 创建时选择游戏，类型锁定；通用成员、房主、连接、账号接管；结束后回房间重开；新的 matchId | `apps/server/src/rooms.ts`、`apps/web/src/App.tsx`、`packages/protocol/src/platform` |
| 卡坦 / catan | 保留现有规则与增量同步；规则适配器和桌面组件从公共入口中拆出；重开隔离旧命令、计时器与 AI 回调 | `apps/server/src/games/catan`、`apps/web/src/games/catan`、core 的既有领域模块 |
| 传画猜词 / draw-guess | 3–6 人首轮从六个词中选词并亲自作画，随后传画、猜词；猜词字数提示；画笔/橡皮/撤销/重做；私密草稿双端恢复；超时收稿；系统主持人自动逐页揭晓并串词、完整画册和再来一局 | 规则、协议、服务端与网页各自的 `draw-guess` 目录 |

## 为什么保持这个规模

两个游戏使用显式分派与独立类型，不引入动态插件系统、通用回合引擎或万能状态对象。核心规则仍只有 `game-core` 一个包；Catan 的领域模块继续遵守 ADR-0004，传画猜词不依赖这些领域。`protocol` 中的玩家视图按 `gameId` 区分，传画猜词没有假的地图、手牌或获胜者。

房间目录只保留一份权威记录。游戏适配器处理游戏本身的创建、开始、设置、命令、投影、计时器与结算；账号和成员不会分别实现两遍。现有 npm 包名暂时保留 `@catan/*`，避免一次大面积改名造成无关发布风险。

包内入口已经按领域拆开，不再提供 `@catan/game-core` 或 `@catan/protocol` 根入口。导入规则分别使用 `/catan`、`/draw-guess` 和 `/primitives`；协议使用 `/platform`、`/catan`、`/draw-guess`，跨游戏传输分派使用 `/transport`。旧的 `PlayerSessionResponse` 已删除，座位响应统一为 `RoomSession`，需要限制游戏时使用 `RoomSession<RoomView>`。

网页公共 `RoomUpdates` 只负责会话、版本和状态发布。Catan 的历史缓冲、补页与 ACK 确认在 `apps/web/src/games/catan/room-sync.ts`；传画猜词不创建这套同步策略。公共账号历史按需加载游戏各自的记录组件，Catan 的业务组件归入 `games/catan/components`。现有卡坦动画继续按 AGENTS.md 留在 `src/effects`。

服务端 `games/<gameId>/routes.ts` 与 `schemas.ts` 承接游戏接口；Catan 的 AI、历史投影、计时和结算实现归入自己的目录。适配器只拿到按 ID 查询本游戏房间的函数，成员和凭证仍由同一份房间目录管理。边界检查覆盖 core、protocol、server、web，并允许通过公共入口使用 primitives。

## 添加第三个游戏

1. 在 `docs/rules` 写规则，确定人数、私密信息、结束条件与时间规则。
2. 在 `game-core` 新建独立模块和包子路径，先写无界面的规则测试。
3. 在 `protocol` 新建该游戏的请求、投影与版本化结果；加入游戏目录和视图联合。
4. 在服务端新增小型游戏适配器，在房间目录中接入显式分派；共用账号、房主、座位和持久化接口。
5. 在网页 `games/<gameId>` 添加独立桌面，通过公共 App 接入；避免把专有动作塞进公共组件。
6. 添加独立规则、隐私、服务端和多人浏览器测试入口；保留所有已有游戏回归。

## 后续，不在本次范围

- 为多人公共匹配、观战或房主掉线自动转移制定产品规则。
- 若要保存或分享画册，先明确保留期、访问权限、删除与内容治理；当前不会把画作和词语写入 SQLite。
- 为新游戏验证真实 iOS Safari 触控、浏览器栏和安全区域。Chromium 模拟不等于真机通过。
- HTTPS 与内置语音独立立项；当前 HTTP 约束不变。

## 分块开发与测试

当前规则见 [按模块开发与回归](testing.md) 和 ADR-0015。`scripts/testing/scopes.mjs` 统一测试归属，浏览器目录与 Playwright 项目按 platform、catan、draw-guess 分开；`tests/architecture` 与 `scripts/testing` 属于 tooling。

- `pnpm test:plan` 先说明 Git 改动影响的模块和层；`pnpm validate` 默认只执行该计划。
- `pnpm validate:draw-guess --layer web` 只验证传画猜词网页层；Catan 和 platform 提供同名模块入口。
- `pnpm test:<scope>` 可加 `--layer`、`-t`；`pnpm test:e2e:<scope>` 可加 `--grep` 或文件过滤。
- 手机测试先选游戏，使用 `test:e2e:catan:mobile` 或 `test:e2e:draw-guess:mobile`。桌面局部控件不默认展开手机矩阵。
- 公共原语、传输和共享 UI 的改动按消费者扩展；单游戏业务改动不会自动选择另一个游戏。
- `validate:all` / `validate:full` 仅供明确的集成或发布需要，不能当作每次提交门槛。

早期交付证据见 [多游戏验证](validation/multi-game.md)，它记录历史执行范围，不定义当前要求。
