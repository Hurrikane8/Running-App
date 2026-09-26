"""Generate the narration track with Kokoro TTS and a timeline of line cues.

Usage: python3 tts.py <script.json> <kokoro.onnx> <voices.bin> <out_dir>
Writes <out_dir>/voice.wav (24 kHz mono) and <out_dir>/timeline.json.
"""
import json
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

script_path, model_path, voices_path, out_dir = sys.argv[1:5]
script = json.load(open(script_path))
kokoro = Kokoro(model_path, voices_path)
SR = 24000


def synth(text):
    phonemes = kokoro.tokenizer.phonemize(text, "en-us")
    for src, dst in script.get("pronunciations", {}).items():
        phonemes = phonemes.replace(src, dst)
    audio, sr = kokoro.create(
        phonemes, voice=script["voice"], speed=script["speed"], lang="en-us", is_phonemes=True
    )
    assert sr == SR
    # Trim residual near-silence at both ends so our own pauses control pacing.
    thresh = 0.01
    idx = np.where(np.abs(audio) > thresh)[0]
    if len(idx):
        a = max(0, idx[0] - int(0.03 * SR))
        b = min(len(audio), idx[-1] + int(0.08 * SR))
        audio = audio[a:b]
    # Short fades to avoid clicks.
    f = int(0.01 * SR)
    audio[:f] *= np.linspace(0, 1, f)
    audio[-f:] *= np.linspace(1, 0, f)
    return audio


chunks = [np.zeros(int(script["lead_in"] * SR), dtype=np.float32)]
t = script["lead_in"]
cues = []
for line in script["lines"]:
    audio = synth(line["text"])
    dur = len(audio) / SR
    cues.append({"id": line["id"], "scene": line["scene"], "text": line["text"],
                 "start": round(t, 3), "end": round(t + dur, 3)})
    print(f'{line["id"]:>3} {t:7.2f} {dur:5.2f}  {line["text"][:60]}')
    chunks.append(audio.astype(np.float32))
    t += dur
    pause = np.zeros(int(line["pause"] * SR), dtype=np.float32)
    chunks.append(pause)
    t += len(pause) / SR

tail = np.zeros(int(script["tail"] * SR), dtype=np.float32)
chunks.append(tail)
t += len(tail) / SR

voice = np.concatenate(chunks)
peak = np.max(np.abs(voice))
voice = voice / peak * 0.89
sf.write(f"{out_dir}/voice.wav", voice, SR)
json.dump({"duration": round(len(voice) / SR, 3), "cues": cues}, open(f"{out_dir}/timeline.json", "w"), indent=1)
print("total", len(voice) / SR)
