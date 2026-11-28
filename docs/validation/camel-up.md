# 骆驼大赛交付验证

日期：2026-11-25。开发前仓库由 `5a918c7` 快进至 `62993de`，工作区当时无未提交修改。

## 范围

- camel-up：独立 core、protocol、server、web 与 browser；3–6 人，含六人合伙。规则与可见的网页版约定见 `docs/rules/camel-up.md`。
- platform：游戏目录、房间分派、入口按钮、账号结果选择与按需加载。
- tooling：新增游戏的测试归属、正向 Playwright 项目、导入边界与脚本入口。
- Three.js 和字体只由骆驼大赛加载。既有锁文件解析未被替换，只增加该渲染器及其类型依赖。构建所有受影响包，验证平台契约与游戏隔离；未运行卡坦和传画猜词的玩法回归。

## 非浏览器检查

- `pnpm test:plan`：开发前确认干净工作区；开发中使用 `--scope camel-up` 与 `--scope "platform,camel-up,tooling"` 核对范围。
- `pnpm validate --scope "platform,camel-up,tooling" --build`：通过。四个包类型检查、游戏核心与隐私投影、适配器、账号/房间/SQLite、公共网页状态、测试选择器、跨游戏边界、HTTP API 保护与生产产物构建。
- `pnpm validate:camel-up --layer web --build`：最终 3D、字体、动效与高堆叠适配通过网页检查、静态保护及生产构建。
- `pnpm --filter @catan/web exec vitest run src/components/Welcome.test.tsx`：3 个用例通过，含新游戏入口。
- 核心有 12 个用例，含 40 组确定性完整对局重放，检查不丢驼、不复制骆驼、排名、币值与骰子数量不变量。
- 网页动作反馈测试覆盖首次快照、重复快照、重连、跳过 revision 和新局不重放旧动效。
- `pnpm test:inventory --json` 通过；`pnpm test:e2e:all --list` 收集 167 个用例、29 个文件（仅收集，未执行全部游戏）。
- `git diff --check` 通过。

生产构建保留一个 Three.js 模型/引擎按需块约 575 KB（gzip 约 146 KB），Vite 给出大于 500 KB 的提示。该块不属于大厅、账号历史、卡坦或传画猜词的首屏加载路径。没有通过抬高阈值屏蔽提示。

## 浏览器与画面

`pnpm test:e2e:camel-up` 的 9 个场景通过，之后新增并单独执行 `pnpm test:e2e:camel-up --grep "portrait action film"`，新增 1 个场景通过；当前全部 10 个用例均有通过记录。

- 三座位真实房间：暗投、领票、摇骰、投影隐私、刷新接回座位、完整终局、再开一局与新 matchId。
- 六人手机：底部操作区可见、长名称、无横向/页面溢出、观众牌 44 px 以上点按区域、规则/房间对话框、浏览器可用高度变化及模拟安全区。
- 真实 Chromium WebGL 2：旋转、缩放、复位，模拟上下文丢失后自动 SVG 回退，回退后仍可摇骰。
- 两个浏览器区域的七驼堆叠视觉夹具：相机留出高度，七只位置有可读 DOM 列表；减少动态设置下的静态画面。此项是投影视觉夹具，不冒充真实多人玩法回归。
- 手机操作录像：服务器接受的摇骰、领票、暗投、放观众牌、六人合伙、后续摇骰与赛段结算，逐项等待反馈显示与消退。抽帧检查出骰、位移、暗投保密、玩家切换和金币结算。

实际引擎：Chromium。设备模拟使用共享 `viewport-cases.ts`，不是物理 iPhone 或 iOS Safari 验证。

| 设备 | CSS 画布 | DPR |
| --- | --- | --- |
| iPhone 16 portrait full-canvas | 393 × 852 | 3 |
| iPhone 16 portrait browser-area | 393 × 659 | 3 |
| iPhone 16 Pro Max portrait full-canvas | 440 × 956 | 3 |
| iPhone 16 Pro Max portrait browser-area | 440 × 763 | 3 |
| iPhone 14 portrait browser-area（兼容） | 安装的 Playwright iPhone 14 描述符 | 3 |

截图部分以 `scale: css` 导出，CSS 视口与设备 DPR 没有因此修改。真实浏览器栏、刘海/Home Indicator、触控手势与手机 GPU/耗电仍需真机检查；当前没有声称 iOS Safari 认证。

## 平台边界

`pnpm test:e2e:platform --grep "game choice|account history loads"`：3 个用例通过。覆盖默认游戏选择、加入/房主继任及桌面/iPhone 16 浏览器区域账号历史；新增断言确认查看其他游戏历史不会加载骆驼大赛 3D 渲染器。

## 资源与产物

- 原创 3D 模型和图标源：`apps/web/src/games/camel-up/three`。
- 本地字体、OFL、来源与复现字符集：`apps/web/public/games/camel-up/fonts`，两套 WOFF2 共约 158 KiB。
- 兼容模式的原创 image_gen 背景与提示：`apps/web/public/games/camel-up/README.md`。
- 忽略的本地复核截图/录像：`output/playwright/camel-up`。不提交录像、截图、TTF 中间文件或数据库。
- 本次没有部署到生产，也没有修改生产数据库。

## 后续调整：简化棋子与换字体（2026-11-25）

本轮仅影响 camel-up/web：用户要求换掉手写风格字体，并简化骆驼形状。标题换成本地得意黑 Smiley Sans（子集约 49 KB，附 OFL 与下载来源），正文和操作恢复清晰的 Noto Sans SC Variable。旧版字体不再注册或加载。

骆驼从多个球体、细腿、眼睛、鞍毯与尾巴组成的模型，改为单个带圆角的一体式厚片棋子。3D、图标与 SVG 共用 `camel-silhouette.ts`，堆叠步长与新轮廓同步调整；相机、动作反馈和规则不变。

验证：

- `pnpm test:plan --scope camel-up`：核对既有变更范围后，选取 web 检查。
- `pnpm validate:camel-up --layer web`：类型检查、2 个反馈测试、6 个边界测试与 4 个 HTTP API 保护测试通过。
- `pnpm --filter @catan/web build`：通过，仍有已记录的 Three.js 按需块大小提示。
- `pnpm test:e2e:camel-up --grep 'three seats|six-player portrait|seven-camel|3D camera'`：9 个用例通过。覆盖桌面，四个主要手机竖屏 full-canvas/browser-area、iPhone 14 兼容、七驼堆叠、减少动态和上下文丢失回退。引擎为 Chromium，未运行物理设备/iOS Safari。
- 已检查 iPhone 16 full-canvas 与 Pro Max browser-area 截图；本轮不重复无关游戏玩法测试。
- Impeccable 机械检查 `detect --json --changed` 返回空结果；`git diff --check` 通过。

本地复核截图：`output/playwright/camel-up/refined-iphone16.png` 与 `refined-phone-browser-area.png`。字体来源与复现信息见 `apps/web/public/games/camel-up/fonts/SmileySans-source.md`。

## 合入前隐私检查（2026-11-25）

暂存审查发现初始化曾展开完整房间成员，可能把座位凭证和账号标识带进核心玩家对象，再经玩家投影发送。先加入失败测试重现，再同时收紧适配器输入、核心初始化与协议投影的字段白名单。

- 核心新增结构化宽输入回归；共 13 个核心用例。
- 协议回归显式注入额外敏感字段，确认投影丢弃；服务端与真实三座位浏览器流程确认视图不含任何座位凭证或账号标识。
- `pnpm validate:camel-up --build` 通过；`pnpm test:e2e:camel-up --grep 'three seats'` 通过。
- 暂存文件检查排除了浏览器产物、数据库和日志。上游 OFL 原文有三处行尾空格，按原文保留；排除 `*-OFL.txt` 的 `git diff --cached --check` 通过。

## 2026-11-28 movement readability

Camel-up web presentation now waits 650ms for the die and advances along the projected track one space per 420ms, with a hop at each step. Stacked pieces share timing; reduced-motion users receive immediate endpoints. Rules and transport are unchanged.

Validation: `pnpm validate:camel-up --layer web` passed (typecheck, four game tests, architecture and insecure-context guards). `pnpm test:e2e:camel-up --grep 'three seats place'` passed in desktop Chromium, including movement start/end and reconnect. Physical devices and iOS Safari were not tested.

`pnpm test:e2e:camel-up --grep 'portrait action film'` also passed in Chromium using the repository's first primary phone case (iPhone 16 portrait full-canvas, 393×852 CSS px).
