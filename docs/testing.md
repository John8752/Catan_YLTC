# 按模块开发与回归

这是当前测试范围的唯一规则入口，配合根目录 `AGENTS.md` 使用。旧里程碑和 `docs/validation` 中的全量执行记录不再构成每次修改的门槛。先说明改了哪个模块、哪个层，再选择验证；不能因为两个游戏在同一个 pnpm workspace，就把另一个游戏也回归一遍。

## 所属模块和代码层

| 模块 | 产品职责 | 单元/集成测试位置 | 浏览器测试 |
| --- | --- | --- | --- |
| platform | 账号、房间、座位、公共入口、平台传输契约 | protocol/platform；server/platform、auth、database；web 公共组件、会话、lib | tests/e2e/platform |
| catan | 卡坦规则、地图、手牌、交易、历史、反馈 | core 的 Catan 领域目录；protocol/catan；server/games/catan；web/games/catan、effects | tests/e2e/catan |
| draw-guess | 选词、画画、猜词、草稿、提示、揭晓 | core/draw-guess；protocol/draw-guess；server/games/draw-guess；web/games/draw-guess | tests/e2e/draw-guess |
| tooling | 测试选择、CI、依赖边界 | scripts/testing、tests/architecture | 收集清单验证，不自行开启游戏回归 |

代码层为 `core`、`protocol`、`server`、`web`、`browser`、`tooling`。游戏测试跟随自己的实现；公共测试即使使用某个游戏作为身份/传输夹具，也只验证平台契约。浏览器的 Catan 夹具放在 `tests/e2e/catan/fixtures.ts`，账号历史也使用它，因此该夹具修改同时影响 platform 和 catan 的浏览器测试。公共设备描述统一在 `tests/e2e/viewport-cases.ts`。

`scripts/testing/scopes.mjs` 是机器可执行的归属表；本文件解释选取原则。`pnpm test:inventory` 要求每个测试文件恰好属于一个模块；遗漏、重复归属或放在未声明目录的新测试会直接失败。Playwright 用三个正向 `testMatch` 项目选取，禁止靠“排除另一个游戏”来定义卡坦范围。新增游戏/代码领域需要同时增加归属、入口和选择器测试。

## 默认命令

```sh
pnpm test:plan                 # 只显示 Git 改动对应的模块、层和测试清单
pnpm validate --dry-run        # 显示将执行的命令，不运行
pnpm validate                 # 受影响层的类型检查、单元/集成测试、静态安全检查
pnpm test                     # 只运行受影响的单元/集成测试
pnpm check                    # 只检查受影响的 workspace 包
pnpm test:e2e --list           # 收集受影响游戏的浏览器用例，不启动服务器
```

本地默认比较 `HEAD` 与整个工作区，包含已暂存、未暂存、未跟踪和删除文件。工作区包含多项未提交工作时，计划会合并这些改动；不要误称为“本次只改了一个文件”。提交后可使用 `--base <本次工作的起点> --head HEAD`，也可以直接选择模块。CI 用 PR base/head 或 push before/after，不用上一提交猜测影响范围；首次提交使用空树。跨游戏移动同时计算旧、新路径，已删除的历史无归属测试会在计划中明确标为迁移影响；新文件不能利用这个例外逃过 inventory。

没有变更或只有说明性 Markdown 变化时，不运行游戏测试，也不退回全量。未知源代码路径、未知模块/层、新增无归属测试或无效 Git base 会报错，需修正映射或参数。规则文档声明要改变行为时，仍必须按规则工作流实现并验证，不能用“只改文档”代替交付。

## 明确缩小范围

```sh
pnpm validate:draw-guess                  # 传画猜词四层，不运行卡坦玩法
pnpm validate:draw-guess --layer web      # 只检查网页层、网页测试及静态安全
pnpm test:draw-guess --layer core         # 只跑传画猜词规则测试
pnpm test:catan --layer server           # 只跑卡坦服务端测试
pnpm validate:platform                   # 平台契约、账号和房间测试
pnpm validate:tooling                    # 选择器测试和架构边界
pnpm test:draw-guess --layer core -t "opening"
pnpm test:e2e:draw-guess --grep "finished gallery.*desktop"
pnpm test:e2e:platform --grep "account registration"
pnpm test:e2e:catan --grep "three isolated seats"
pnpm test:e2e:draw-guess:mobile
```

显式模块命令在干净工作区也能执行完整模块检查；`--layer` 再缩小到一层。多个模块可用 `--scope "platform,draw-guess"`。当同时给出 `--base` 或 `--files` 时，显式模块与改动集合取交集，CI 因此只检查该模块受影响的层。

包内的 `pnpm test` 同样按 Git 改动选择该包所在层，不会暗中整包执行；包内 `pnpm test:all` 才明确执行该层所有模块。类型检查仍以 workspace 包为编译单元。

给 `test` 传递参数时写成 `pnpm run test --files ...`（包过滤可放在 `run` 前），避免 pnpm 的 `test` 别名自行解析选项。PowerShell 的多模块参数要加引号，例如 `--scope "platform,draw-guess"`。

`--files` 接收逗号分隔、使用 `/` 的仓库相对路径，用于查看/运行某个改动场景，例如 `pnpm validate --files apps/web/src/games/draw-guess/DrawWork.tsx --dry-run`。它按修改所在模块和层选择测试，并非把任意文件交给 Vitest。具名单元用例用 `-t`；浏览器可在选定项目后附加文件过滤或 `--grep`。如果一次修改需要更多测试，应说明依赖或风险证据，然后追加对应模块/层。

## 什么变化需要什么回归

| 修改 | 默认非浏览器范围 | 浏览器验收 |
| --- | --- | --- |
| draw-guess 桌面局部选词控件 | draw-guess/web | 同游戏的桌面控件/提交流程；不跑卡坦，不自动展开手机矩阵 |
| draw-guess 规则、任务分配 | draw-guess 的 core → protocol → server → web | 同游戏受影响的多人流程；无需卡坦建路/交易/港口回归 |
| Catan 投影、隐藏信息 | catan 的 protocol → server → web | 相关 Catan 多座位、隐私或重连场景 |
| 某游戏 server 适配器 | 该游戏/server | 受影响的命令、超时、重连流程 |
| 账号逻辑、账号 DTO | platform 的相应层及下游 | 账号登录/接管/记录；使用游戏房间作为夹具不意味着回归全部规则 |
| 公共 primitives、房间目录、WebSocket 分派 | 明确使用它们的模块和层 | 受影响的两游戏/平台契约场景 |
| 共享按钮、主题、viewport/safe-area | platform/web、两个游戏/web | 实际共享该布局/控件的游戏矩阵 |
| 游戏测试文件本身 | 该文件所属模块和层 | browser 文件只选择自己的游戏项目 |
| 选择器、测试归属、CI、Playwright 配置 | tooling | 收集受影响项目，必要时每个移动项目选一个代表用例验证接线 |
| 依赖图、包导出、打包配置、部署 | 受影响应用及下游，并构建 | 按实际分发/运行风险选择；明确的发布集成可全量 |

根/包 manifest 的测试/检查脚本或测试工具依赖变化，经前后内容比较确认后属于 tooling；构建/启动脚本、编译器、运行时依赖、导出等变化扩大到对应应用及消费者。lockfile 仅移动已有测试工具 importer、且解析结果未变时属于 tooling；无法证明是此类变化的锁文件/解析图更新需要集成验证，计划会明确列出所有受影响范围。不能把所有 `package.json` 修改一律当作 UI 修改，也不能把脚本重命名一律当作游戏规则变化。

类型检查与玩法回归不同：现有四个 workspace 包仍作为编译单元，检查一个应用时 TypeScript 可能跟随共享类型、联合协议等导入读取其他模块。`validate` 会明确列出检查哪些包；这不应触发另一个游戏的规则重放、浏览器流程或设备矩阵。

静态保护也单列：有源码类型检查的验证包含跨模块 import 边界；网页层还检查 plain-HTTP 禁用 API。它们扫描文件，不启动卡坦或传画猜词对局。直接 `test:<scope>` 用于快速单元迭代，交付使用相应 `validate` 以覆盖这些保护。

## 手机验收按影响选择

桌面局部控制不要求手机验收。可在两端使用的局部对话框/面板，覆盖一个桌面及 iPhone 16 portrait browser-area 的最长内容/最多玩家；只有涉及全局响应式、画布、viewport 或游戏主表面时，才展开该游戏的主要手机矩阵。共用的主题/安全区改动才需要跨游戏检查。

| 主机型 | Full canvas | Browser area | DPR |
| --- | --- | --- | --- |
| iPhone 16 | 393 × 852 | 393 × 659 | 3 |
| iPhone 16 Pro Max | 440 × 956 | 440 × 763 | 3 |

用 `tests/e2e/viewport-cases.ts` 中的定义。`pnpm test:e2e:catan:mobile` 检查 Catan 的地图/港口/HUD；`pnpm test:e2e:draw-guess:mobile` 检查选词、Canvas、字数提示、主持人和画册。没有跨游戏默认 `test:e2e:mobile`。局部场景继续用 `--grep` 缩小，不把一整个手机 suite 当作所有 UI 修改的固定步骤。报告实际引擎和尺寸，Chromium 模拟不等于真机 Safari 验收。

## 构建、CI 与显式集成

普通改动的 `validate` 不自动启动浏览器或执行生产构建。依赖/打包/部署变化由计划触发构建，也可以明确加 `--build`；需要整个所属游戏浏览器 suite 时可加 `--browser`，局部验收优先单独 `test:e2e:<scope> --grep ...`。`pnpm build` 保留为部署用的完整产物构建入口，不代表运行所有游戏测试。

CI 的计划任务和每个模块 matrix job 使用同一选择器：自动执行受影响层的非浏览器验证，并收集该项目的浏览器用例。tooling 变化会收集全部项目以检查配置与导入，但不会执行游戏。收集成功不等于浏览器实际通过；有交互变化仍要记录相应的本地/专用浏览器执行证据。CI 不再无条件调用完整 workspace gate。手动 `workflow_dispatch` 是明确的完整集成运行，会安装 Chromium 并实际执行全量。

```sh
pnpm test:all           # 明确需要：所有单元/集成测试（包括 tooling）
pnpm test:e2e:all       # 明确需要：所有游戏/平台浏览器回归
pnpm validate:all       # 全部非浏览器检查与产物构建
pnpm validate:full      # 上述内容加全部浏览器回归
pnpm test:catan:replay  # Catan 的完整规则重放，可单独定位
```

全量用于明确的跨模块集成、测试结构迁移核验或发布要求，需要记录原因。它不再是每次提交、每次规则调整的默认要求；不要为了“保险”重复两遍。重放、边界检查已在完整单元集合中，全量 gate 不重复跑一遍；手机用例已包含在所属浏览器集合中，也不重跑一次。

遇到失败先跑失败用例。只有新修复影响其他用例时才扩大到相应 suite；一次无关游戏超时不应让当前单游戏工作反复全跑。验证记录应写明范围、命令、结果、没有验证的相关风险，保留失败与重试证据。
