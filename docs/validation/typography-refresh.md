# 大厅与游戏字体排版调整

日期：2026-11-27。比较基线：`a5f2c56`。

## 范围与实现

本次属于 `platform` 和五个游戏的 `web` 层。共享按钮、全局字体 reset 和
`cn` 会影响所有游戏的 DOM 操作区，因此选择所有消费者的网页检查和相关
浏览器布局场景；没有改动 core、protocol 或 server，不运行规则重放。

- 正文、玩家输入和功能控件继续使用完整的 Noto Sans SC Variable。展示标题
  与静态游戏名使用本地 600 字重宋体子集；骆驼大赛保留 Smiley Sans 400。
- 语义字号为正文 16px、控件 14px、辅助说明 13px；密集地图标注继续使用
  游戏自身的比例。正文常规、标签中等、功能标题半粗，减少不必要的粗黑。
- 将 `font: inherit` 和标题默认样式放入 Tailwind base，避免覆盖字号、字重
  和等宽字体 utility；`cn` 显式注册语义字号，避免颜色类吞掉字号类。
- 宋体资源为 22,732 字节，155 个码位，真实静态字重 600。FontTools 检查
  确认标题清单无缺字，字体名称为 YLTC Table Serif，保留 OFL 元数据；生产
  构建中包含同大小文件。来源、校验值和生成方法在 `public/fonts/README.md`。
- 德扑盲注标签使用 12px，并置于卡背上方；浏览器检查标签两端实际命中元素，
  防止文字被遮挡。卡牌字号、花色形状和 Catan 地图比例未改。

## 非浏览器检查

| 实际执行命令 | 结果 |
| --- | --- |
| `pnpm test:plan` | 选择六个消费者的 web 层，未扩大到规则或服务端 |
| `pnpm validate --layer web --build` | 53 个网页测试文件、184 项测试通过；8 项架构检查通过；含 plain-HTTP API 守卫、TypeScript 检查与网页生产构建 |
| `pnpm validate:texas-holdem --layer web` | 最后调整标签层级后通过；8 项德扑网页测试、8 项架构检查和 4 项浏览器 API 守卫通过 |
| `git diff --check` | 通过 |

构建保留既有 Three.js 大分包提示；未改变依赖或包导出。

## 浏览器验收

实际引擎为 Playwright Chromium。使用测试框架启动的隔离服务和内存 SQLite，
未复用开发数据库。主要手机矩阵来自 `viewport-cases.ts`，DPR 3：
393×852、393×659、440×956、440×763；另包含骆驼大赛的 iPhone 14
browser-area 390×664。覆盖桌面 1280×720、1280×800、1366×768、
1440×900 和 1920×1021 的相应场景。

| 实际执行命令 | 结果与范围 |
| --- | --- |
| `pnpm test:e2e:platform typography.spec.ts lobby-design.spec.ts` | 19 项通过：本地字体与字重、房间码等宽、五游戏切换、最大人数组桌、WebGL/复制回退、减少动态、开局 |
| `pnpm test:e2e:catan:mobile` | 46 项通过：四/六人地图与港口比例、缩放、底部操作、交易、必要动作和相关提示 |
| `pnpm test:e2e:carcassonne:mobile` | 11 项通过：五人桌、放置/随从、区域详情、长条地图、浏览器栏、安全区 |
| `pnpm test:e2e:draw-guess:mobile` | 首轮 23/24 通过；1 项发现滚动基线时序问题，见下文复核 |
| `pnpm test:e2e:draw-guess gallery.spec.ts --grep 'reveal appends.*iPhone 16 Pro Max portrait full-canvas'` | 未改实现时单独复跑通过；改进测试取值时序后同一命令再次通过 |
| `pnpm test:e2e:draw-guess gallery.spec.ts play.spec.ts --grep 'reveal appends\|guess input keeps'` | 6 项通过：揭晓桌面与四手机矩阵、16px 输入下限和用户字号放大 |
| `pnpm test:e2e:camel-up --grep 'six-player portrait\|seven-camel stack\|three seats place'` | 8 项通过：桌面多人流程、六人手机操作、iPhone 14 兼容与极端堆叠 |
| `pnpm test:e2e:texas-holdem --grep 'nine-seat legible\|two browsers create'` | 5 项通过；增加标签遮挡断言后同命令再跑 5 项通过，含桌面加注和四手机九人桌 |
| `pnpm run test:e2e --scope 'platform,catan,carcassonne' --grep 'entry remains usable when font downloads fail\|4 seats fit 1366x768\|6 seats fit 1920x1021\|portrait table, placement and disclosures fit 1440x900'` | 5 项通过：桌面/手机字体下载失败回退、Catan 两个桌面布局、卡卡颂桌面操作 |

上述去重后为 119 个浏览器场景，全部获得通过结果。传画猜词首轮失败发生于
取消自动平滑滚动后的两次相邻取值（100→101px）；单独复跑即通过。测试现在
等待合成滚动连续三帧稳定再记录点赞基线，并额外严格比较点赞前后页面位置与
高度，没有放宽滚动断言，也没有改动游戏滚动实现。

## 视觉与设计检查

检查本轮生成的首页桌面/手机、五游戏满员组桌，以及各游戏操作区截图。
截图保存在忽略目录 `output/playwright`，不提交浏览器产物；历史
`font-refresh` 目录的旧截图不作为本次证据。

- 标题与控件层次清楚；用户文字保持完整字体覆盖；长名字按现有规则截断或换行。
- 字体请求来自本站，`swap` 保持可见文字；桌面和手机阻断字体下载后仍可操作。
- Catan 的地图文字与港口同比例缩放；德扑牌面保留独立字号和红黑花色形状。
- Impeccable 最终人工复核未发现阻断问题。按无 hook 的要求执行一次
  `impeccable.cmd detect --json --changed`，得到 229 项 advisory，零 warning/error：
  171 项既有局部颜色、13 项既有圆角、45 项字号。新增展示字号已记入 DESIGN；
  其余字号属于原有游戏密度、地图世界单位、结果/动效和旧样式，不在本次统一
  放大。未为消除提示而改动游戏颜色、几何或缩放策略。
- 设计工具报告已有 sidecar 配置漂移，留待显式维护任务；本次未修复工具安装。

未运行真机 iOS Safari 验收，不宣称真机/Safari 认证。本记录对应提交前验收，未部署线上。
