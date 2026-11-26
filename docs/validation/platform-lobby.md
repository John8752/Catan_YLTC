# Platform: 3D 首页与原生组桌预览

2026-11-26。范围为 platform/web、五款游戏的 waiting adapters 与展示模型；正式对局渲染未重做。卡坦保留服务器地图的 SVG 预览、同比缩放、港口、换图和地图产能分析。德州扑克既有 2–9 人限制抽为 core 常量，行为不变。

## 非浏览器验证

- `pnpm test:plan`：首页、共用组桌 UI 和入口影响各游戏 web；扑克常量影响该游戏消费者；分派边界与测试归属为 tooling。没有选择全游戏玩法集成 gate。
- `pnpm validate --layer web --build`：48 个 web 测试文件、173 个用例通过；8 个架构边界用例通过；网页类型检查与生产构建通过。后续小范围文案/布局修正另跑相关文件与类型检查。
- `pnpm validate:texas-holdem`：core、protocol、server、web、架构边界与普通 HTTP 浏览器 API 保护通过。
- `pnpm validate:tooling` 与 `pnpm test:inventory`：通过；新测试有唯一归属。共用大厅模块的未来改动也选择其 web 消费者。
- `pnpm --filter @catan/web exec vitest run src/components/Welcome.test.tsx src/games/catan/components/LobbySetup.test.tsx src/games/texas-holdem/controls.test.tsx`：13 个用例通过。
- Impeccable detector 无阻断项；场景局部材质颜色与既有 RoomPanel 小字为 advisory。首屏检查在 1440×900、390×844 通过；选择游戏是无需名称的首要动作，创建仍要求名称。

## 浏览器范围

全部使用 Chromium、独立 E2E 服务与内存 SQLite。主力竖屏尺寸来自 `tests/e2e/viewport-cases.ts`，DPR 3：393×852、393×659、440×956、440×763。390×844 仅为额外兼容截图。不是 iOS Safari 或真机验收。

- `pnpm test:e2e:platform --workers=1` 的 29 个场景中，账号、记录按需加载、首页五场景、WebGL/复制失败、减少动态效果、上下文丢失、五游戏真实开局、离座/房主交接、字体和未知游戏共 24 项通过。5 个原生组桌矩阵初次读取到缩放过渡帧，改为等待复位完成后执行 `pnpm test:e2e:platform lobby-design.spec.ts --grep 'native lobby' --workers=1`，5 项通过。每个矩阵覆盖卡坦四/六人、传画猜词六人、骆驼六人、卡卡颂五人和德州九人；检查真实地图、全部港口、缩放、人数、复制、底部动作和横向溢出。
- `pnpm test:e2e:catan:mobile --workers=2`：46 项通过，覆盖四/六人主力手机、地图/港口比例、缩放、行动区、信息披露及既有交互。无须重复其他游戏的正式对局手机回归。
- `pnpm test:e2e:catan first-playable.spec.ts --grep 'three isolated' --workers=1`：三独立浏览器创建、加入、设置、颜色、乱序、开局、掷骰与恢复通过。产能分析由默认展开改为可展开，断言同步验证其可达性。
- `pnpm test:e2e:texas-holdem play.spec.ts --grep 'two browsers create' --workers=1`：创建、保存设置、下注、断线恢复、结算及同房重开通过。
- `pnpm test:e2e:draw-guess play.spec.ts --grep 'six independent browsers' --workers=1`：六独立浏览器设置、选词、绘画、恢复草稿、猜词、自动揭晓、反应重试与同房重开通过。旧人数文案断言改为核对真实成员计数。

## 渲染与失败记录

首轮大量并发软件 WebGL 上下文造成测试超时，改用单 worker，并让展台完成一次入场后按需渲染。早期截图发现卡坦旧全局 flex 样式撑高 SVG 容器，改为显式有界的原生地图容器；没有单独放大港口或文字。静止 WebGL 帧保留用于离屏恢复与截图，场景卸载释放几何、纹理、材质与观察器。

后续并行测试服务曾在 Windows 争用同一个 Vite 依赖缓存，出现 `EPERM` 和一次动态模块加载失败；该轮不能作为功能通过证据，桌面失败场景串行复跑通过。未使用在运行的开发服务或用户数据库作验收。

最终视觉复核还发现按需渲染的画布在尺寸变化后会先清空 drawing buffer，再等下一帧重画，偶尔在全页截图里留下空白。渲染器改为在 ResizeObserver 同一轮直接重画；回归在同一轮检查实际画布像素，覆盖减少动态效果下已停止动画的场景。不是用静态图片覆盖空白。

该修正后执行 `pnpm test:e2e:platform lobby-design.spec.ts --grep 'native lobby|reduced motion' --workers=1`，6 项通过；重新生成五个最大人数矩阵的完整截图与首屏拼图，逐张确认 3D 场景存在。最终网页生产构建通过。

截图在忽略目录 `output/playwright/lobby-design/`，真实首屏复核拼图在 `apps/web/.impeccable/review/`。设计方向与实际边界见 [大厅设计](../design/platform-lobby.md)。

最终独立视觉复核为 `ship`。地图编号、设置同步提示和设计文档三项修正均确认解决；对最终新目录中的完整截图重新复核，3D 空白帧证据问题已解决。

## 展台穿模与深度闪烁修正

2026-11-26。卡坦六角模型额外旋转 30 度后与网格方向不一致，产生 42 对重叠顶面；德扑两张展示牌位于同一高度，牌面覆盖层又贴近实体表面。移除错误旋转、抬高地块以离开水面，分开两张牌的高度并把纹理直接应用到实体顶面。共用入场改为从底座上方落稳，避免经过底座内部。正式对局地图、规则和网络状态未改。

- 两个新几何回归文件先在旧模型上复现 4 项失败，修正后 4 项通过；覆盖地块多边形相交、地块与水面、牌体之间及牌体与桌面间距、纹理表面。
- `pnpm test:plan`：共用渲染器影响六个 web 消费者，因此执行 `pnpm validate --layer web`；50 个文件、177 个网页用例与 8 个架构检查通过，类型检查通过。
- `pnpm test:e2e:platform lobby-design.spec.ts --grep '3D lobby|native lobby|reduced motion' --workers=1`：11 项通过，独立服务与内存 SQLite。覆盖桌面、393×852 / 393×659 / 440×956 / 440×763 的主力竖屏模拟，游戏切换、最大人数原生预览、缩放和减少动态效果。
- 人工复核卡坦与德扑桌面及 393×659 首页截图；实际引擎为 Chromium，未进行 iOS Safari 或真机检查。截图位于忽略目录 `output/playwright/lobby-depth-fix-*.png`。
