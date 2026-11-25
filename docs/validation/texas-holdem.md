# 德州扑克开发与验证

日期：2026-11-25。分支 `codex/texas-holdem`，独立 managed worktree `C:/Users/Administrator/.codex/worktrees/texas-holdem/Catan_YLTC`，基于已提交的 `main` / `62993de`。原 `E:/Catan_YLTC` 中未提交的骆驼大赛改动保留原处，未混入本分支；本次没有合并或部署。

## 范围

- texas-holdem：2–9 人虚拟筹码无限注；固定盲注与约定手数模式，以及按手数升盲的锦标赛模式。
- core：显式完整牌序、烧牌/发牌、单挑与多人位置、下注权、最小加注、累计短全下、摊牌牌型、独立边池、退款、奇数筹码、淘汰和并列排名；完整确定性重放。
- protocol：玩家安全底牌投影、合法操作、请求 DTO、稳定且安全的 effects、版本化最终结算。
- server：安全随机洗牌、当前玩家/局/手数/revision 校验、commandId 幂等、计时与断线超时、6 秒手间停留、同房重开、最终 SQLite 记录。
- web：大厅接入、模式设置、椭圆环桌、翡翠绿/曜石黑两种配色、白底大点数/大花色牌、Radix 加注 Popover 与结算 Dialog、账号历史。
- motion：发牌、盲注、过牌、跟注、加注、全下、弃牌、收注、公共牌和摊牌翻开、派奖、退款。初始和重连快照不重放；减少动态移除空间运动，保留可读反馈。
- platform/tooling：公共目录分派、游戏目录及历史入口；独立测试归属、消费者选择和正向 Playwright 项目。

规则约定见 [规则](../rules/texas-holdem.md)，界面约束见 [设计](../design/texas-holdem.md)。本项目明示使用移动庄位、按手升盲和自动超时的家庭局规则，不模拟现金桌、重入或线下赛事的全部管理条款。

## 非浏览器验证

以下命令实际执行通过。

| 命令 | 结果与目的 |
| --- | --- |
| `pnpm test:plan --scope texas-holdem` | 四层与独立 browser 范围；所有新增测试归属明确 |
| `pnpm validate:texas-holdem --build` | 四个 workspace 类型检查与生产构建，7 个本游戏测试文件共 34 例；架构 7 例、plain-HTTP API 静态保护 4 例 |
| `pnpm validate:texas-holdem --layer web --build` | 最后动效、加注快捷值及防重播修改后的网页复验；6 例网页测试、静态保护和网页构建通过 |
| `pnpm validate:platform` | 公共目录、账号、座位和会话契约；1 个协议、23 个服务端、20 个网页用例通过，另有架构保护 |
| `pnpm validate:tooling` | 24 个测试选择用例及架构保护通过；包含 Windows/Linux 同名 worktree 的正向目录匹配 |
| `pnpm test:e2e:all --list` | 仅收集，165 个用例 / 29 个文件；不运行其他游戏玩法 |

核心重放覆盖 2–9 人、两种模式、每种配置 12 个种子，各重放两遍以比较完整状态，共 192 种配置 / 384 次完整对局。每次动作断言筹码守恒、非负整数和已发牌唯一性。

## 浏览器验证

Chromium，隔离测试服务与内存 SQLite。8 个德州扑克用例通过分批聚焦执行覆盖，未把手机矩阵当作多个重复 gate。

实际执行入口包括：

- `pnpm test:e2e:texas-holdem --grep 'two browsers'`：两端从首页创建/加入、加注/弃牌、刷新恢复、固定手数结束、同房换新 matchId。
- `pnpm test:e2e:texas-holdem --grep 'tournament mode'`：锦标赛全下/摊牌直至结束，公开牌、牌型、最终排名和结果弹窗。
- `pnpm test:e2e:texas-holdem --grep 'iPhone 16 portrait browser-area'`：新版环桌中最矮主手机浏览器区域的聚焦检查。
- `pnpm test:e2e:texas-holdem --grep 'accepted action motion|nine-seat.*(full-canvas|Pro Max)'`：其余三种主手机区域及普通/减少动态动作测试，5 例通过。
- `pnpm test:e2e:texas-holdem --grep 'accepted action motion'`：动作语义、重连和重新加载防重播；实际检查原生 WAAPI 帧定义，减少动态不含 transform。

9 人采用 24 字姓名与长名称，检查：头像沿桌边分布、头像不盖公共牌、底池在公共牌上方、完整公共牌和底牌、按钮尺寸和边界、横向溢出、浏览器区域缩小及安全区 top=24/bottom=20 CSS px。安全区通过 CDP `Emulation.setSafeAreaInsetsOverride` 模拟，断言实际 computed padding。

| 设备描述 | CSS viewport | DPR |
| --- | --- | --- |
| iPhone 16 portrait full-canvas | 393×852 | 3 |
| iPhone 16 portrait browser-area | 393×659 | 3 |
| iPhone 16 Pro Max portrait full-canvas | 440×956 | 3 |
| iPhone 16 Pro Max portrait browser-area | 440×763 | 3 |

尺寸直接来自 `tests/e2e/viewport-cases.ts`。实际引擎是 Chromium 设备模拟，不是 iOS Safari 或物理设备验收。截图位于被忽略的 `output/playwright/poker-*.png`，四组主手机已人工查看；普通/减少动态的分帧证据位于 `output/playwright/motion/{normal,reduced}/{raise,fold}`。

## 动效审阅

Playwright 驱动真实隔离服务，采集同一加注与弃牌交互的普通/减少动态两套完整手机区域，保存前态、中间帧、最终态、时间/几何报告、filmstrip 和本地 scrubber。使用自定义采集是因为技能 CLI 不支持注入房间 seat/session。

首次审阅指出同座位收池/退回提示重叠、减少动态文字反馈太短、弃牌路径经过结果按钮。三项均修复：汇总为单个两行提示，文字使用 1800ms linear 总时间线（减少动态 90ms 淡入、1620ms 保持、90ms 淡出），弃牌移向左下弃牌区。最终动效 reviewer 判定 `ship`，仅覆盖这四组证据与上述三项修复；其他动作通过功能测试确认事件和反馈，不据此声称全部动作或物理机帧率已获视觉认证。

## 修复与限制

- 开发时发现 glob 会匹配名为 `texas-holdem` 的 worktree 祖先目录，从而误收其他游戏用例；立即停止误选运行，改为锚定 `tests/e2e/<scope>` 的正向表达式，并增加选择器回归。误选运行不作为其他游戏通过证据。
- 初版截图暴露公共牌裁切及方格布局不符用户参考；最终改为竖向椭圆环桌并补充垂直可见性、底池与头像避让断言。
- 不以全局“无动画”为截图等待条件；行动倒计时本身会更新 SVG 圆环。截图等待有限的 authored animations，排除持续更新的 CSS transition，避免把计时器误判成未完成动作。
- 未运行真实 iOS Safari、物理设备 GPU/帧率测试、线上 HTTP 真机联调或部署。本次没有游戏内现金、充值、重入、抽水或复制第三方品牌素材。
