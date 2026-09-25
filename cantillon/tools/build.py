#!/usr/bin/env python3
"""Inline everything into one self-contained HTML file.

  src/template.html  page skeleton
  src/style.css      page CSS
  src/js/*.js        engine + choreography, concatenated in filename order
  src/fonts/*.woff2  Bricolage Grotesque + IM Fell English (SIL OFL 1.1)
  src/audio/narration.mp3 + src/audio/timing.json   from tools/narrate.py

Writes index.html (the deliverable) and build/artifact.html (same page without
the document wrapper, for hosts that supply their own <html>/<head>/<body>).
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
BUILD = ROOT / "build"

FONTS = [
    ("Bricolage", "bricolage-grotesque-latin.woff2", "normal", "200 800"),
    ("Fell", "im-fell-english-latin.woff2", "normal", "400"),
    ("Fell", "im-fell-english-italic-latin.woff2", "italic", "400"),
]


def b64(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main():
    faces = []
    for family, file, style, weight in FONTS:
        faces.append(
            f'@font-face{{font-family:"{family}";src:url(data:font/woff2;base64,{b64(SRC / "fonts" / file)}) '
            f'format("woff2");font-style:{style};font-weight:{weight};font-display:block}}'
        )
    js = "\n".join(p.read_text() for p in sorted((SRC / "js").glob("*.js")))
    timing = json.dumps(json.loads((SRC / "audio" / "timing.json").read_text()), separators=(",", ":"))

    page = (SRC / "template.html").read_text()
    for key, value in {
        "/*@FONTS*/": "/* Bricolage Grotesque (c) The Bricolage Grotesque Project Authors; IM Fell English (c) Igino Marini.\n   Both SIL Open Font License 1.1, see src/fonts/OFL.txt */\n" + "\n".join(faces),
        "/*@STYLE*/": (SRC / "style.css").read_text().strip(),
        "/*@TIMING*/": timing,
        "/*@AUDIO*/": b64(SRC / "audio" / "narration.mp3"),
        "/*@SCRIPT*/": '"use strict";\n(() => {\n' + js + "\n})();",
    }.items():
        assert key in page, key
        page = page.replace(key, value)

    out = ROOT / "index.html"
    out.write_text(page)

    # Artifact hosts wrap the page in their own document; drop ours.
    frag = re.sub(r"<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*", "", page, flags=re.I)
    frag = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", frag)
    BUILD.mkdir(exist_ok=True)
    (BUILD / "artifact.html").write_text(frag)
    print(f"{out.relative_to(ROOT.parent)}: {len(page.encode()) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
