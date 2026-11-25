# 骆驼大赛字体

当前标题采用本地[得意黑 Smiley Sans](./SmileySans-source.md)，正文和按钮采用仓库已有的 Noto Sans SC Variable。标题与正文均从本站加载，不依赖字体 CDN。

以下为旧版资源来源，保留供历史复现；当前界面不再注册或加载站酷快乐体与霞鹜文楷。

# 旧版字体归档

下载日期：2026-11-25。仅网页交付的 WOFF2 子集，未发布可安装桌面字体。原始版权与许可文件逐字保留。

## ZCOOL KuaiLe

- 用途：display。
- 来源：[ZCOOL KuaiLe](https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf)
- 原始 SHA-256：`812a6fc1fe54b6d73a419245c32dfeba8aa33104d5be90d1cf6af082007cb71d`
- 文件：`ZCOOLKuaiLe-UI.woff2`，50,608 字节。
- 许可：`ZCOOLKuaiLe-OFL.txt`（SIL OFL 1.1）。

## LXGW WenKai Medium v1.530

- 用途：body。
- 来源：[LXGW WenKai Medium v1.530](https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Medium.ttf)
- 原始 SHA-256：`f4b8a34d1f838fe411540cb7c97b1c384ac9738a876c4104500bc42508b2312a`
- 文件：`LXGWWenKai-UI.woff2`，110,936 字节。
- 许可：`LXGWWenKai-OFL.txt`（SIL OFL 1.1）。

## 子集与更新

使用 FontTools `subset.Subsetter` 取 `apps/web/src/games/camel-up`、`packages/protocol/src/camel-up`、`packages/game-core/src/camel-up` 内 `.ts/.tsx` 的字符并加 ASCII 与常见姓名字；输出 `font.flavor = "woff2"`。当前 UI 文件变更若出现新汉字，应更新子集。未覆盖的玩家姓名和新文案由既有 Noto Sans SC 自托管字体回退，界面不会出现缺字方块。

`typography.css` 的 `@font-face` 使用本域路径与 `font-display: swap`，不用 Google/CDN 运行时请求。两套 UI 字体总计约 158 KiB，避免移动端加载完整的 25 MB 文楷 TTF。源 TTF 为构建中间文件，不提交。

复现命令（先下载上面两个源文件，安装 `fonttools` 与 `brotli`）：

```sh
pyftsubset ZCOOLKuaiLe-Regular.ttf --text-file=ui-glyphs.txt --flavor=woff2 --desubroutinize --output-file=ZCOOLKuaiLe-UI.woff2
pyftsubset LXGWWenKai-Medium.ttf --text-file=ui-glyphs.txt --flavor=woff2 --desubroutinize --output-file=LXGWWenKai-UI.woff2
```
