#!/usr/bin/env python3
"""Render the narrator track for the Cantillon Effect animation.

Reads src/narration.json, speaks every line with the open-weight Kokoro-82M
voice model (Apache-2.0), and writes:

  src/audio/narration.mp3   24 kHz mono, loudness-normalised, embedded in the page
  src/audio/timing.json     start/end of every line and every spoken word
  build/narration.wav       the same audio, uncompressed

Word timings come straight from the model: the ONNX export is patched to expose
the per-phoneme duration tensor it already computes, so on-screen typography can
land on the exact syllable instead of an estimate.

Setup (once):
  python3 -m venv .venv && . .venv/bin/activate
  pip install kokoro-onnx onnx soundfile imageio-ffmpeg "misaki[en]"
  python3 -m spacy download en_core_web_sm
Model files are fetched into .models/ on first run.
"""
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / ".models"
BUILD = ROOT / "build"
AUDIO = ROOT / "src" / "audio"
RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
SR = 24000


def fetch(name):
    MODELS.mkdir(exist_ok=True)
    dest = MODELS / name
    if not dest.exists():
        print(f"downloading {name} ...", file=sys.stderr)
        urllib.request.urlretrieve(RELEASE + name, dest)
    return dest


def model_with_durations():
    """Kokoro computes phoneme durations internally; expose them as an output."""
    patched = MODELS / "kokoro-v1.0-dur.onnx"
    if patched.exists():
        return patched
    import onnx
    from onnx import TensorProto, helper

    m = onnx.load(str(fetch("kokoro-v1.0.onnx")))
    # Rounded, clipped (>=1) frame count per input token, batch item 0.
    m.graph.node.append(helper.make_node("Identity", ["/encoder/Gather_output_0"], ["duration"]))
    m.graph.output.append(helper.make_tensor_value_info("duration", TensorProto.INT64, ["tokens"]))
    onnx.save(m, str(patched))
    return patched


def main():
    import onnxruntime as ort
    from kokoro_onnx.config import DEFAULT_VOCAB
    from misaki import en, espeak

    spec = json.loads((ROOT / "src" / "narration.json").read_text())
    voices = np.load(fetch("voices-v1.0.bin"))
    voice = voices[spec["voice"]]
    sess = ort.InferenceSession(str(model_with_durations()), providers=["CPUExecutionProvider"])
    g2p = en.G2P(trf=False, british=False, fallback=espeak.EspeakFallback(british=False))
    space = DEFAULT_VOCAB[" "]

    def speak(text, speed):
        _, toks = g2p(text)
        ids, spans = [], []
        for t in toks:
            start = len(ids)
            ids += [DEFAULT_VOCAB[c] for c in (t.phonemes or "") if c in DEFAULT_VOCAB]
            spans.append((t.text, start, len(ids), t.phonemes or ""))
            if t.whitespace:
                ids.append(space)
        audio, dur = sess.run(None, {
            "tokens": np.array([[0, *ids, 0]], dtype=np.int64),
            "style": voice[len(ids) - 1].astype(np.float32),
            "speed": np.array([speed], dtype=np.float32),
        })
        audio = np.asarray(audio, dtype=np.float32).ravel()
        frames = np.concatenate([[0], np.cumsum(np.asarray(dur).ravel())])
        edges = frames * (len(audio) / frames[-1])  # sample offset of each token edge
        words = []
        for text_, s, e, ph in spans:
            if e > s and any(ch.isalnum() for ch in text_):
                # model token k+1 is ids[k] (a pad token leads the sequence)
                words.append({"w": text_, "s": edges[s + 1] / SR, "e": edges[e + 1] / SR, "ph": ph})
        return audio, words

    track = [np.zeros(int(spec["leadIn"] * SR), np.float32)]
    cursor = spec["leadIn"]
    lines = []
    for line in spec["lines"]:
        speed = line.get("speed", spec["speed"])
        audio, words = speak(line.get("say", line["text"]), speed)
        # Trim the model's edge silence using the word timings, keep a breath of room.
        a = max(0, int((words[0]["s"] - 0.06) * SR))
        b = min(len(audio), int((words[-1]["e"] + 0.16) * SR))
        seg = audio[a:b].copy()
        fade = int(0.012 * SR)
        seg[:fade] *= np.linspace(0, 1, fade)
        seg[-fade:] *= np.linspace(1, 0, fade)
        off = cursor - a / SR
        for w in words:
            w["s"] = round(w["s"] + off, 3)
            w["e"] = round(w["e"] + off, 3)
        # Display words: map spoken tokens back onto the on-screen text.
        lines.append({
            "id": line["id"],
            "text": line["text"],
            "start": round(cursor, 3),
            "end": round(cursor + len(seg) / SR, 3),
            "words": [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in words],
        })
        track.append(seg)
        cursor += len(seg) / SR
        gap = line.get("pause", 0.3)
        track.append(np.zeros(int(gap * SR), np.float32))
        cursor += gap
        print(f'{line["id"]:>9} {lines[-1]["start"]:6.2f}-{lines[-1]["end"]:6.2f}  {line["text"]}')

    track.append(np.zeros(int(spec["tail"] * SR), np.float32))
    audio = np.concatenate(track)
    BUILD.mkdir(exist_ok=True)
    raw = BUILD / "narration.raw.wav"
    sf.write(raw, audio, SR)

    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    # Two-pass EBU R128 normalisation to -16 LUFS / -1.5 dBTP (voice sits on top of a quiet bed).
    probe = subprocess.run([ff, "-hide_banner", "-i", str(raw), "-af",
                            "loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    stats = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
    norm = (f"loudnorm=I=-16:TP=-1.5:LRA=9:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
            f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
            f"offset={stats['target_offset']}:linear=true")
    wav = BUILD / "narration.wav"
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-af", norm,
                    "-ar", str(SR), "-ac", "1", str(wav)], check=True)
    AUDIO.mkdir(parents=True, exist_ok=True)
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                    "-c:a", "libmp3lame", "-b:a", "64k", "-ar", str(SR), "-ac", "1", str(AUDIO / "narration.mp3")],
                   check=True)

    duration = len(audio) / SR
    (AUDIO / "timing.json").write_text(json.dumps({"duration": round(duration, 3), "lines": lines}, indent=1))
    spoken = sum(len(l["words"]) for l in lines)
    print(f"total {duration:.2f}s, {spoken} words, {spoken / duration * 60:.0f} wpm overall")


if __name__ == "__main__":
    main()
