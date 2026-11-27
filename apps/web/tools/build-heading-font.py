"""Build the small, self-hosted display face. Requires fonttools[woff].

Only curated static headings use this face; player content keeps the full Noto
Sans SC family. This tool is manual, never a network dependency of app builds.
"""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

COMMIT = "8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5"
SOURCE_SHA256 = "050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9"
BASE = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/notoserifsc/"
DEST = Path(__file__).resolve().parents[1] / "public" / "fonts"


def main():
    with urlopen(BASE + "NotoSerifSC%5Bwght%5D.ttf", timeout=60) as response:
        source = response.read()
    if sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("Pinned font source checksum mismatch")
    with urlopen(BASE + "OFL.txt", timeout=30) as response:
        license_text = response.read()
    with TemporaryDirectory(prefix="yltc-heading-font-") as directory:
        source_path = Path(directory) / "source.ttf"
        source_path.write_bytes(source)
        font = TTFont(source_path, recalcTimestamp=False)
        instantiateVariableFont(font, {"wght": 600}, inplace=True)
        names = {1: "YLTC Table Serif", 2: "SemiBold", 3: "YLTC Table Serif SemiBold subset", 4: "YLTC Table Serif SemiBold", 6: "YLTCTableSerif-SemiBold", 16: "YLTC Table Serif", 17: "SemiBold"}
        for record in list(font["name"].names):
            if record.nameID in names:
                font["name"].setName(names[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
        options = subset.Options()
        options.name_IDs = ["*"]
        options.name_legacy = True
        options.name_languages = ["*"]
        cutter = subset.Subsetter(options=options)
        text = (DEST / "heading-text.txt").read_text(encoding="utf-8")
        cutter.populate(unicodes=set(map(ord, text)) | set(range(0x20, 0x7F)))
        cutter.subset(font)
        font.flavor = "woff2"
        output = DEST / "YLTCTableSerif-Semibold.woff2"
        font.save(output)
        (DEST / "NotoSerifSC-OFL.txt").write_bytes(license_text)
        print(f"source SHA256 {sha256(source).hexdigest()}")
        print(f"{output.name}: {output.stat().st_size} bytes; {len(font.getBestCmap())} code points")


if __name__ == "__main__":
    main()
