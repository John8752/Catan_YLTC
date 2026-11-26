# Platform: 3D 大厅与组桌页

## Direction contract

THESIS: 首页用原创 3D 微缩展台选游戏；组桌页统一 DOM 操作外壳，预览遵循各游戏自身媒介。卡坦必须保留本局真实 SVG 地图、缩放与换图，不能用装饰性 3D 岛屿替代。

OWN-WORLD: 暖木展台、自然颜料、真实几何与柔和接触阴影。五款游戏保留各自海蓝、纸紫、沙金、草绿、墨绿气氛。中文沿用本地 Noto Sans SC。

STORY: 看见游戏 → 选择 → 填名称并创建 → 分享房间码 → 朋友入座 → 调整本游戏设置 → 房主开始。已有房间码的玩家从独立入口直接加入。

FIRST VIEWPORT: 首页桌面中央偏左为大幅 3D 展台，右侧为游戏说明和开桌操作，下方为五游戏选择条。手机为紧凑导航、展台、选择条、说明和开桌操作；组桌时采用游戏原生预览、真实玩家名单与本局设置，底部保持开始入口。传画猜词为纸面风格；骆驼与卡卡颂为 3D；德州为牌桌风格。

FORM: seed: none (pinned)。用户确认“可以按照你描述的方式去实现，我需要看到效果”，承接已描述的“会随游戏变换的桌游展台”与“首页看桌、组桌入座”。采用 code-led 实现真实 Three.js 场景。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and the working interaction.

## Boundaries

- Platform presentation only. Rule behavior, authoritative room legality, settings contracts, anonymous entry and immutable room gameId remain unchanged. Poker's existing 2–9 player bounds are named in core for consumers to reuse.
- Lobby seats show membership, not invented readiness or online status (the protocol does not expose per-member connectivity).
- Game-specific capacity and minimums come from each core; Catan uses its selected rule profile. Settings remain game-owned.
- Lazy-load the renderer independently of form interaction. WebGL failure retains a static preview and all controls. Reduced motion settles immediately. Dispose geometry, textures, observers and rendering on unmount; stop work in hidden/offscreen views.
- Clipboard uses selectable room text with a best-effort legacy copy action, preserving plain HTTP support.
- Primary portrait acceptance: shared iPhone 16 and Pro Max full-canvas/browser-area cases; desktop multiplayer creation, joining, settings, departure, host transfer and start.

## Implemented surface

首页在 1024px 起使用展台与开桌表单双列，手机依次展示展台、五游戏选择条和表单。组桌页复用房间码、成员席位、设置侧栏和固定底部开始栏；手机允许纵向滚动，底部留白和安全区内边距保护最后一项操作。设置仍由各游戏负责，各适配器向共享外壳提供提示文案。卡坦与传画猜词由房主修改后立即提交，德州修改后须点击保存，未保存时不能开始；骆驼与卡卡颂明确提示本局使用固定规则。

`presentation.ts` 的海蓝、纸紫、沙棕、草绿与墨绿背景，以及 Three.js 模型的木色、纸色和颜料色，均为场景局部表现。共享暖木、纸面与本地 Noto Sans SC 体系保持原样，没有新增全局调色板。首页标题使用局部字号节奏，不重定义共享字体 token。

首页五个展台使用原创程序几何、正交相机、真实灯光与接触阴影。卡坦组桌展示 `room.previewMap` 的 SVG 地图，港口与地形共同缩放；产能分析默认收起，地图编号以标题下方的普通元数据展示。传画猜词组桌使用二维纸面，骆驼与卡卡颂组桌使用 3D 展台，德州组桌展示未发牌的牌堆。装饰场景不读取暗牌，也不决定开局地图或合法性。

席位取自玩家安全的成员投影和各游戏 core/profile 容量，只标记房主、自己与已入座；没有准备状态或逐玩家在线状态。3D 场景独立延迟加载，入场结束后按需渲染，隐藏或离屏暂停持续动画，卸载释放资源；减少动态效果直接呈现终态。尺寸变化在 ResizeObserver 同次回调内同步绘制，避免画布缓冲区重置后闪现空白帧。静态后备画面不阻断 DOM 控件。房间码保留可选择文本和普通 HTTP 下可用的复制后备路径。

## Documentation review evidence

本次文档核对读取 `Welcome.tsx`、`components/lobby/*`、`lobby-art.ts`、`lobby-dispatch.tsx`、五款游戏的 `WaitingRoom.tsx`，以及卡坦 `LobbySetup.tsx`、德州 `PokerLobby.tsx` 和程序模型源码。对照现有 `apps/web/DESIGN.md` 与 `src/styles.css`，仅合并本次首页及组桌页的已实现结构，保留前置 token、既有游戏规则和 `.impeccable/design.json`。

目视检查的产物包括 `.impeccable/review/desktop.png`、`mobile.png`、`home-all-games.png`、`rooms-desktop.png` 和四张 `rooms-iPhone-16{,-Pro-Max}-portrait-{full-canvas,browser-area}-primary-phone.png`。它们展示五款首页与卡坦四/六人、传画猜词六人、骆驼六人、卡卡颂五人、德州九人的首屏。原尺寸完整页面保存在 `output/playwright/lobby-design/`。截图核对不等于重新执行自动化；确切测试命令与结果由本次验证记录单独报告，不声称真机或 iOS Safari 验证。

现有系统文档中与本次无关的渲染器描述、提取路径和 sidecar 预览陈旧项不在此扩展中修复，也不将旧眉题样式或局部小字提升为新的共享规则。
