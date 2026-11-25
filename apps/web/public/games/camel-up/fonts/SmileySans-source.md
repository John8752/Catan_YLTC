# 得意黑 Smiley Sans

用于骆驼大赛标题，正文采用仓库已有的 Noto Sans SC 可变字体。

- 上游：[atelier-anchor/smiley-sans](https://github.com/atelier-anchor/smiley-sans)
- 下载：[v2.0.1 字体包](https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip)
- 原文件：SmileySans-Oblique.ttf
- 原始 SHA-256：`b447d7e781f08bc95c4c9f23ba71ed2b8ebb639aa7184485c71c4ca5afcd25c4`
- 当前子集：`SmileySans-UI.woff2`，49,628 字节。
- 许可：`SmileySans-OFL.txt`（SIL OFL 1.1 原文）。
- 字符集：`smiley-ui-glyphs.txt`，缺字回退到本域 Noto Sans SC。

复现：`pyftsubset SmileySans-Oblique.ttf --text-file=smiley-ui-glyphs.txt --flavor=woff2 --desubroutinize --output-file=SmileySans-UI.woff2`。

站酷快乐体和霞鹜文楷保留为旧版资源，不再注册或加载。
