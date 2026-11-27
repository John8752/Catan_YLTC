# Self-hosted Chinese fonts

Body, controls, player names and map labels use Noto Sans SC Variable from the
existing `@fontsource-variable/noto-sans-sc` dependency. Its OFL is in this folder.
Camel Up display headings use the existing Smiley Sans asset and license under
`public/games/camel-up/fonts`.

`YLTCTableSerif-Semibold.woff2` is an OFL-licensed, weight-600 subset of
[Noto Serif SC](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserifsc).
It is renamed internally to **YLTC Table Serif** to identify the modified font.
Copyright and license metadata are retained; `NotoSerifSC-OFL.txt` is distributed
alongside it. The subset is 22,732 bytes and covers the static headings in
`heading-text.txt` plus printable ASCII. Never use it alone for player content;
the CSS stack falls back to the full sans family for other characters.

To change a static display heading, update `heading-text.txt`, install
`fonttools[woff]` (the checked-in asset was generated with 4.68.0), then run:

```sh
python apps/web/tools/build-heading-font.py
```

The manual generator pins the upstream revision above and verifies source SHA256
`050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9`.
It downloads into a temporary directory; the application build and runtime need
no external font service or Python installation. All font faces use `swap`.
