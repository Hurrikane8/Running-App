"""Estimate per-word start times inside each narration line.

Kokoro's ONNX export has no duration output, so we spread each line's measured
duration over its words in proportion to phoneme count, with extra weight for
punctuation pauses. Accurate to a few hundred ms, which is plenty for syncing
animation beats to specific words.

Usage: python3 words.py <timeline.json> <kokoro.onnx> <voices.bin> <out_js>
Adds a "words" list to every cue and writes timeline.json back plus a
`window.TIMELINE = ...` JS file for the animation page.
"""
import json
import re
import sys

from kokoro_onnx import Kokoro

tl_path, model_path, voices_path, out_js = sys.argv[1:5]
tl = json.load(open(tl_path))
kokoro = Kokoro(model_path, voices_path)

PAUSE = {",": 0.14, ".": 0.32, "?": 0.32, "!": 0.32, ":": 0.2, ";": 0.2}

for cue in tl["cues"]:
    tokens = cue["text"].split()
    counts, pauses = [], []
    for tok in tokens:
        word = re.sub(r"[^\w'-]", "", tok)
        ph = kokoro.tokenizer.phonemize(word, "en-us") if word else ""
        counts.append(len(re.sub(r"[ˈˌː\s]", "", ph)) or 1)
        pauses.append(PAUSE.get(tok[-1], 0.0))
    dur = cue["end"] - cue["start"]
    total_pause = sum(pauses[:-1])
    per = max(dur - total_pause, dur * 0.6) / sum(counts)
    t = cue["start"]
    words = []
    for tok, n, p in zip(tokens, counts, pauses):
        words.append([re.sub(r"[^\w'-]", "", tok).lower(), round(t, 3)])
        t += n * per + p
    cue["words"] = words

json.dump(tl, open(tl_path, "w"), indent=1)
with open(out_js, "w") as f:
    f.write("window.TIMELINE = " + json.dumps(tl) + ";\n")
print("ok", len(tl["cues"]))
