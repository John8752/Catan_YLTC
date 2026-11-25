# 卡卡颂基础版开发与验收

日期：2026-11-25。工作区：`codex/carcassonne`，基于 `62993de` 创建的独立 worktree。原始目录的骆驼大赛未提交工作没有搬入本工作区。

## 交付范围

- `carcassonne` 独立核心、协议投影、服务端适配器和懒加载 React 桌面。沿用公共账号、匿名入场、房间目录、座位恢复与终局结算接口。
- 2–5 人、24 类共 72 块基础板块（含起始板块）、每人 7 名随从。包含道路环路、交叉路口、城市/盾徽、多数与并列、修道院八邻格、农夫、不可放板块弃除和终局结算；无扩展。
- 明确的半边端口连接田地，不通过像素判断规则。同一区域中的不同板块与同一已完成城市都按唯一标识去重。
- 命令绑定 match/turn，服务器验证位置、四种旋转与随从目标。请求去重，终局保存失败后保持原回合可重试。投影不包含牌堆顺序、种子或凭证。
- 固定俯视的原创 2.5D SVG 微缩模型、板块材质与厚度、屋顶及木随从。地图平移/双指缩放，全图/预览/最新定位，区域连接与归属检查，田地供应城市高亮。
- 点选预览 → 旋转 → 选随从或不放 → 完成回合。吸附、旋转、落位、确认落桌、得分提示和回合强调有各自反馈；减少动态路径取消位移动画。新对局重新建立相机，不重播旧得分。

## 核心、协议和服务端

已执行 `pnpm validate:carcassonne --build`，通过四包类型检查、基础测试、静态架构/浏览器 API 检查与生产构建。之后的服务端用例补充执行 `pnpm test:carcassonne --layer server`，4 项通过；最终服务端类型检查 `pnpm --filter @catan/server check` 通过。

当前三份测试文件共 21 项：核心 15、协议 2、服务端 4。覆盖完整五人确定性重放、随从供给、闭合道路、同板多城段计分去重、同一城市多次接触农田只计一次、农夫多数、修道院对角格、牌堆隐藏、HTTP 身份校验与重复请求、最新登录替换座位、整局完成后写入真实内存 SQLite、游戏分区、完整性检查、再开新 match 及终局写入失败重试。没有写入开发数据库。

最终界面修正后另执行 `pnpm validate:carcassonne --layer web --build`，通过网页类型检查、6 项架构检查、4 项不安全上下文 API 检查及网页生产构建。

## 浏览器与设备矩阵

`E2E_API_PORT=8796`、`E2E_WEB_PORT=5196`。所有浏览器回归启动隔离的测试进程，SQLite 为内存库，`reuseExistingServer=false`。未使用试玩或骆驼大赛开发服务器进行验收。

`pnpm test:e2e:carcassonne --workers=2`：16 项通过。增加新 match 相机隔离后，`pnpm test:e2e:carcassonne --grep 'fresh matches' --workers=1` 再验证对应场景，通过。

| 情况 | CSS 视口 | DPR | 引擎 |
| --- | --- | --- | --- |
| iPhone 16 全画布 | 393×852 | 3 | Chromium 模拟 |
| iPhone 16 浏览器区域 | 393×659 | 3 | Chromium 模拟 |
| iPhone 16 Pro Max 全画布 | 440×956 | 3 | Chromium 模拟 |
| iPhone 16 Pro Max 浏览器区域 | 440×763 | 3 | Chromium 模拟 |
| 大屏安卓补充竖屏 | 412×915 | 2.625 | Chromium 自定义触控模拟 |
| 桌面 | 1440×900 | 1 | Chromium |

iPhone 案例直接使用 `tests/e2e/viewport-cases.ts`，另检查浏览器栏缩放、模拟上下安全区、减少动态和横向/纵向各 45 块长图。真实多浏览器用例完成开房、入座、拼图、同步、刷新回座、整局计分与再开一局。交互覆盖非法旋转、保留预览的网络失败重试、请求编号复用、田地检查、透明田地/道路/城市的独立可见键盘焦点以及旧分数提示隔离。

未执行物理 iPhone、Android 或真实 iOS Safari 检查；不声明真机触控、Safari 浏览器栏或性能认证。

## 公共消费者与测试隔离

修改了游戏目录、房间显式分派及 App 懒加载分派，因此依据 `pnpm test:plan` 验证其已有消费者的协议、服务端及网页层，未运行已有游戏的规则核心或全量浏览器回归。

- `pnpm validate:platform` 通过；新增入口选择断言后，`pnpm test:platform --layer web` 通过 21 项。平台协议/服务端/网页共 45 项。
- `pnpm validate --scope 'catan,draw-guess' --files 'packages/protocol/src/platform/index.ts,apps/server/src/rooms.ts,apps/web/src/App.tsx,apps/web/src/lib/player-palette.ts'` 通过：协议 53、服务端 50、网页 142 项，另含静态守卫。
- `pnpm test:e2e --scope 'catan,draw-guess' --grep 'three isolated seats|guess input keeps' --workers=2` 中传画猜词案例通过；卡坦案例发现既有重复计时器定位歧义。把其定位限定到公共座位栏后，`pnpm test:e2e:catan --grep 'three isolated seats' --workers=1` 通过。卡坦业务代码未修改。
- `pnpm test:tooling`：24 项测试选择/收集检查与 6 项架构检查通过。所有新增测试恰好归属一个模块。实际收集清单逐项检查项目名与文件所属目录一致。

测试过程中发现祖先 worktree 名称 `carcassonne` 会被旧的全路径 `**/carcassonne/**` 匹配，错误收集其他游戏。已终止该运行，将每个项目的 `testDir` 明确绑定到自己的游戏目录，并增加真实收集清单回归。最终卡卡颂项目只收集 3 个文件、16 个用例。

初次手机测试中的关闭按钮名称错误、减少动态持续时间断言过严均已修正并针对失败案例复验，随后完整卡卡颂矩阵通过。

## 视觉复核

Impeccable code-led 流程沿用已讨论的竖屏构图及既有视觉世界；未虚构图像定稿或 concept-seed 抽签。开发前记录 `docs/carcassonne-design.md`，实现后生成 `apps/web/DESIGN.md` 和对应 `.impeccable/design.json`。

检测器对修改网页执行一次，返回空问题列表。独立视觉审查要求补拍加载完成的大厅，并提出方向记录、透明区域焦点、重复小标题、硬阴影四项修正。补拍和修正后，审查者逐项判为 resolved，给出 `ship`。该最终判断的范围是四项修正的复核，不冒称对整站的审查认证。

本地截图位于忽略的 `output/playwright/carcassonne/`，审查工作材料位于忽略的根 `.impeccable/review/`；不提交截图、浏览器痕迹、日志或数据库。

## 本地试玩隔离

试玩前端 `http://127.0.0.1:5198/`，独立后端 `127.0.0.1:8798`。生产构建可用，HTTP 页面、游戏目录及健康接口已检查。开发数据库位于仓库外 `%USERPROFILE%/.catan-yltc/carcassonne-dev/carcassonne.sqlite`。

重新启动试玩时，在本工作区分别执行：

```powershell
# 后端终端；构建产物由 pnpm validate:carcassonne --build 生成。
$carcassonneData = Join-Path $env:USERPROFILE '.catan-yltc/carcassonne-dev'
New-Item -ItemType Directory -Path $carcassonneData -Force | Out-Null
$env:DATABASE_PATH = Join-Path $carcassonneData 'carcassonne.sqlite'
$env:PORT = '8798'
$env:HOST = '127.0.0.1'
node apps/server/dist/index.js
```

```powershell
# 前端终端
$env:E2E_API_PORT = '8798'
pnpm --filter @catan/web exec vite preview --host 127.0.0.1 --port 5198 --strictPort
```

浏览器测试继续使用 8796/5196 和隔离内存库。运行中的房间按既有 ADR 留在内存中，账号与最终结算写入各自的开发数据库。

## 真 3D 地图改造（2026-11-25）

用户明确要求参考骆驼大赛的实时 3D 展示。只读查看该聊天和独立原始副本的 Three.js 实现后，本 worktree 新增 Carcassonne 自有几何、场景、镜头及可访问 DOM 控件，原 SVG 地图成为兼容分支。规则、协议与服务器行为未因渲染器改变。ADR-0017 记录游戏专属渲染器例外。

### 范围与命令

- 先执行 `pnpm test:plan`；计划包含此前尚未提交的完整游戏实现及本次新增的 Three.js 运行依赖。故本次测试区分为 carcassonne/browser，以及依赖安装影响的四模块 web 层检查/构建；不重跑其他游戏的玩法或设备矩阵。
- `pnpm --filter @catan/web check` 通过。
- `E2E_API_PORT=8796 E2E_WEB_PORT=5196 pnpm test:e2e:carcassonne`：19/19 通过。新增的 `three.spec.ts` 验证实际 WebGL2 场景、画布射线点击、转向/俯视、候选位置起拖不误选、键盘选点；另测 WebGL 创建失败与真实 `WEBGL_lose_context` 降级后的继续落子。
- `pnpm validate --scope "platform,catan,draw-guess,carcassonne" --layer web --build`：45 文件共 163 个网页单元测试、6 个导入边界检查、plain-HTTP API 静态保护、网页类型检查及生产构建通过。没有运行其他游戏浏览器流程。

### 设备与画面

Chromium 模拟的主手机矩阵为 iPhone 16 的 393×852 / 393×659、iPhone 16 Pro Max 的 440×956 / 440×763，DPR 3；另有 412×915 安卓尺寸与 1440×900 桌面。覆盖五人长姓名、落点/旋转/随从流程、两浏览器真实对局完成与重连/再开、43 块中盘及横纵 45 块长图、双指缩放、浏览器栏尺寸变化、安全区与减少动态。截图验证真实模型及阴影。没有运行物理设备或 iOS Safari，不声称真机认证。

### 构建与检测说明

Three.js 场景是进入游戏后懒加载的独立块，生产产物约 644 kB / gzip 167 kB，Vite 记录大于 500 kB 的提示。初始公共入口不加载该场景。静态网格按地形/材质合并、DPR 限制 1.6、只在变化与有限动效期间渲染；尚未做真机帧率/功耗测量。

Impeccable 检测器对改动执行一次，只有局部 10/11px 密度字级与渲染器颜色的 advisory；共同设计文件保留，游戏渲染方向以 `docs/carcassonne-design.md` 为准。独立视觉复核结果另行记录。

首轮独立 3D 视觉复核为 `fix`，提出总览落点拥挤、随从穿插装饰、长图近裁切色带、缺少 3D 随从就位动效四项。已集中修正并复拍。修正期间一个桌面用例发现相机动作后读取了上一帧的就绪状态；相机动作现在立即宣告过渡，选点夹具等待实际投影控件后再继续，失败桌面用例单独复验通过。最终矩阵与视觉判定如下续记。

多人浏览器回归进一步复现一次渲染器回合切换错误：上一回合的道路随从预览在新板块不含该地形时仍被解引用。现在只在投影标记的当前行动者回合绘制预览，随从必须来自该预览的投影选项；固定用例用 U 板块派 `r0` 后切到 B 板块，覆盖失败重试与下一玩家切换，并保留真实双浏览器派人/完成对局场景。该错误是在开发回归中发现，未作为通过结果计入。

最终修正后，在 8796/5196 隔离服务上重新执行完整 `pnpm test:e2e:carcassonne`，19/19 通过（54.1s），本次运行没有热更新或页面未处理错误。随后只调整确认随从与正在落桌板块的高度耦合，补跑派人/重试/双浏览器完整对局、手机/桌面细节及减少动态相关 5 用例，并再次生产构建。公共依赖与其他游戏 UI 未再修改，因此不重复 163 个已通过的网页单元用例。

最后的随从/板块高度耦合修正后，`pnpm test:e2e:carcassonne --grep "two isolated browsers|invalid rotation|review captures|browser bars"` 在 8796/5196 上 5/5 通过（33.5s），随后 `pnpm --filter @catan/web build` 通过，场景块约 644 kB / gzip 167 kB。`pnpm test:inventory` 与 `git diff --check` 通过；后者只有 ADR 索引的换行归一化提示。试玩 8798 健康接口与 5198 页面均正常，原骆驼大赛工作区只作只读参照。

独立视觉 Verdict Pass 为 `ship`：落点密度、随从净空与接触高度、连续桌面、随从有限动效四项全部 resolved。该结论只覆盖四项修正，不冒称整站认证；动效根据源代码复核，没有声称观看现场动画。文档检查为只读：共同 `DESIGN.md` / `design.json` 保持原有文件，确认字体、座位颜色、手机底部停靠与桌面侧栏延续既有体系，新的局部渲染器由方向文档与 ADR-0017 解释；未发现当前范围的实质文档矛盾。

## 合并 main 与骆驼大赛（2026-11-25）

卡卡颂实现提交 `e7a1d13`；合并前 main 为包含骆驼大赛的 `76039cd`。在卡卡颂 worktree 中完成公共游戏目录、房间分派、懒加载、账号记录、包导出、测试范围及 ADR 的冲突解决后验证，再更新 main。骆驼大赛的核心、协议、游戏服务端、网页场景及公开素材与合并前 main 一致。

- `pnpm install --frozen-lockfile`：通过，锁文件与已有依赖匹配。
- `pnpm test:plan`：确认公共分派影响已有消费者，两个新游戏分别拥有各自的测试。没有回归 Catan / draw-guess 核心规则或设备矩阵。
- `pnpm validate --scope "platform,camel-up,carcassonne" --build`：通过四包检查/构建，核心 28、协议 4、服务端 31、网页 24 项及 6 项架构检查。
- `pnpm validate --scope "catan,draw-guess" --files "packages/protocol/src/platform/index.ts,apps/server/src/rooms.ts,apps/web/src/App.tsx"`：通过受影响消费者的协议 53、服务端 50、网页 142 项和静态保护。
- `pnpm validate:tooling`：25 项选择器测试和 6 项架构检查通过；正向项目目录隔离覆盖全部已注册游戏。
- 新增房间人数边界确定性回归：`pnpm --filter @catan/server exec vitest run src/platform/rooms.test.ts -t "seat capacity independent"`：2 项通过，分别确认骆驼大赛 6 人与卡卡颂 5 人上限。
- `E2E_API_PORT=8796 E2E_WEB_PORT=5196 pnpm test:e2e --scope "camel-up,carcassonne" --workers=2`：29/29 通过，包含两游戏的真实多浏览器回合、重连/终局/再开、竖屏及 3D/降级流程。
- `E2E_API_PORT=8797 E2E_WEB_PORT=5197 pnpm test:e2e:platform lazy-history.spec.ts --workers=1`：2/2 通过，确认桌面及 iPhone 16 浏览器区域的账号记录懒加载隔离。
- `git diff main --check` 通过。合并来源自带字体许可的行尾空格保持原样，不修改第三方许可文本。

本次浏览器验收仍为 Chromium 模拟与隔离内存数据库，不是物理 iOS Safari 验证。首次合并检查发现人数分派调用不存在的方法及旧测试夹具导出路径不规范，两项已修正并先复验失败检查，再执行上述通过的合并范围验证。
