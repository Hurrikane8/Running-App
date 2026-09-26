"""Write an .srt caption file from the narration timeline.

Usage: python3 make_srt.py <timeline.json> <out.srt>
"""
import json
import sys
import textwrap

tl = json.load(open(sys.argv[1]))


def ts(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


entries = []
for c in tl["cues"]:
    # split long lines at sentence boundaries, using per-word timings
    words = c["text"].split()
    times = [w[1] for w in c["words"]]
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if (w.endswith((".", "?", "!")) and len(" ".join(words[j] for j in cur)) > 30) or i == len(words) - 1:
            chunks.append(cur)
            cur = []
    for n, idx in enumerate(chunks):
        start = times[idx[0]]
        end = times[chunks[n + 1][0]] - 0.05 if n + 1 < len(chunks) else c["end"] + 0.25
        body = "\n".join(textwrap.wrap(" ".join(words[j] for j in idx), 42))
        entries.append([start, end, body])

# never let a caption run into the next one
for a, b in zip(entries, entries[1:]):
    a[1] = min(a[1], b[0] - 0.05)
out = [f"{k}\n{ts(s)} --> {ts(e)}\n{body}\n" for k, (s, e, body) in enumerate(entries, 1)]
open(sys.argv[2], "w").write("\n".join(out))
print("captions:", len(out))
