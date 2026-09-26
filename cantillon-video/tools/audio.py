"""Build the soundtrack: narration + procedural music bed + synthesized sound effects.

Usage: python3 audio.py <build_dir>
Reads  <build_dir>/voice.wav, timeline.json, sfx.json
Writes <build_dir>/mix.wav (48 kHz stereo)
Everything is synthesized from scratch with numpy (no samples), seeded for
reproducibility.
"""
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

B = sys.argv[1]
SR = 48000
rng = np.random.default_rng(7)

tl = json.load(open(f"{B}/timeline.json"))
fx = json.load(open(f"{B}/sfx.json"))
DUR = tl["duration"]
N = int(DUR * SR) + SR

voice24, vsr = sf.read(f"{B}/voice.wav")
voice = resample_poly(voice24, SR // 8000, vsr // 8000).astype(np.float64)
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
voice = sosfilt(butter(2, 70, "hp", fs=SR, output="sos"), voice)


def T(sec):
    return np.arange(int(sec * SR)) / SR


def env_ad(n, a, d):
    """attack/exponential-decay envelope over n samples"""
    t = np.arange(n) / SR
    e = np.exp(-t / max(d, 1e-4))
    if a > 0:
        e *= np.clip(t / a, 0, 1)
    return e


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lp", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "hp", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bp", fs=SR, output="sos"), x)


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def glide(f0, f1, sec, curve="exp"):
    t = T(sec)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / sec)
    else:
        f = f0 + (f1 - f0) * t / sec
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def partials(freqs, amps, decays, sec):
    t = T(sec)
    out = np.zeros_like(t)
    for f, a, d in zip(freqs, amps, decays):
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    return out


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


# ------------------------------------------------------------------ sound effects
def s_pop():
    x = glide(900, 260, 0.12) * env_ad(int(0.12 * SR), 0.002, 0.045)
    return norm(x, 0.5)


def s_clunk():
    n = int(0.35 * SR)
    x = partials([95, 310, 470, 820], [1, 0.5, 0.35, 0.2], [0.12, 0.06, 0.05, 0.03], 0.35)
    x += lp(noise(0.35), 1800) * env_ad(n, 0.001, 0.03) * 0.6
    return norm(x, 0.7)


def s_whoosh(sec=0.55, lo=300, hi=3500, peak=0.45):
    n = int(sec * SR)
    x = noise(sec)
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * np.clip(t, 0, 1)) ** 2
    y1 = bp(x, lo, lo * 3) * (1 - t)
    y2 = bp(x, hi / 3, hi) * t
    return norm((y1 + y2) * env, peak)


def s_swoosh_long():
    return s_whoosh(1.3, 200, 2600, 0.5)


def s_whoosh_down():
    x = glide(1400, 380, 0.6) * env_ad(int(0.6 * SR), 0.05, 0.3) * 0.4
    return x + s_whoosh(0.6, 400, 2000, 0.2)


def s_scribble(sec=0.45):
    n = int(sec * SR)
    t = np.arange(n) / SR
    mod = 0.5 + 0.5 * np.sin(2 * np.pi * 13 * t) ** 2
    x = bp(noise(sec), 1800, 6000) * mod * np.sin(np.pi * t / sec)
    return norm(x, 0.3)


def s_stamp():
    n = int(0.4 * SR)
    x = glide(140, 55, 0.4) * env_ad(n, 0.001, 0.09)
    x += lp(noise(0.4), 2500) * env_ad(n, 0.0005, 0.025) * 0.8
    return norm(x, 0.8)


def s_thud():
    n = int(0.5 * SR)
    x = glide(110, 40, 0.5) * env_ad(n, 0.002, 0.14)
    x += lp(noise(0.5), 600) * env_ad(n, 0.001, 0.05) * 0.5
    return norm(x, 0.8)


def s_shine():
    out = np.zeros(int(0.9 * SR))
    for k, f in enumerate([2093, 2637, 3136, 4186]):
        p = partials([f, f * 2.01], [1, 0.3], [0.25, 0.1], 0.6)
        i = int(k * 0.07 * SR)
        out[i:i + len(p)] += p
    return norm(out, 0.25)


def s_counter(dur=1.1):
    out = np.zeros(int((dur + 0.1) * SR))
    t = 0.0
    k = 0
    while t < dur:
        click = partials([3200, 5100], [1, 0.5], [0.006, 0.004], 0.03)
        i = int(t * SR)
        out[i:i + len(click)] += click
        k += 1
        t += 0.035 + 0.12 * (t / dur) ** 2
    return norm(out, 0.3)


def s_ding():
    f = 1318.5
    x = partials([f, f * 2.0, f * 2.76, f * 5.4], [1, 0.35, 0.3, 0.12], [1.0, 0.5, 0.35, 0.15], 1.6)
    return norm(x * env_ad(len(x), 0.002, 10), 0.35)


def s_morph():
    sec = 0.9
    n = int(sec * SR)
    t = np.arange(n) / SR
    f = 220 * (3.2) ** (t / sec) * (1 + 0.02 * np.sin(2 * np.pi * 7 * t))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / sec) ** 2 * 0.35
    air = s_whoosh(sec, 250, 3000, 0.35)
    return norm(lp(tone, 2400) + air[:n], 0.4)


def s_coin():
    a = partials([2489, 3951, 5274, 6645], [1, 0.6, 0.4, 0.2], [0.35, 0.22, 0.15, 0.08], 0.7)
    b = partials([2637, 4186], [0.7, 0.4], [0.25, 0.12], 0.5)
    out = np.zeros(int(0.8 * SR))
    out[:len(a)] += a
    i = int(0.07 * SR)
    out[i:i + len(b)] += b
    return norm(out, 0.3)


def s_coins():
    out = np.zeros(int(1.2 * SR))
    for k in range(7):
        c = s_coin() * rng.uniform(0.4, 1.0)
        i = int(rng.uniform(0, 0.5) * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return norm(out, 0.35)


def s_boom():
    sec = 2.4
    n = int(sec * SR)
    x = glide(62, 32, sec) * env_ad(n, 0.003, 0.7)
    x += lp(noise(sec), 400) * env_ad(n, 0.002, 0.25) * 0.6
    x += bp(noise(sec), 2000, 8000) * env_ad(n, 0.001, 0.6) * 0.12
    return norm(x, 0.9)


def s_rise():
    sec = 0.8
    x = glide(300, 1100, sec) * np.sin(np.pi * np.linspace(0, 1, int(sec * SR))) ** 1.5
    return norm(x, 0.2) + s_shine()[: int(sec * SR)] * 0.3


def s_press():
    x = partials([180, 410], [1, 0.4], [0.06, 0.03], 0.25) + lp(noise(0.25), 1200) * env_ad(int(0.25 * SR), 0.001, 0.02) * 0.5
    return norm(x, 0.5)


def s_splash():
    sec = 1.1
    n = int(sec * SR)
    t = np.arange(n) / SR
    x = noise(sec)
    y = np.zeros(n)
    # downward-sweeping filtered noise
    for k, (a, b) in enumerate([(0, 0.15), (0.15, 0.4), (0.4, 1.1)]):
        seg = slice(int(a * SR), int(b * SR))
        y[seg] = bp(x, 800 / (k + 1), 6000 / (k + 1))[seg]
    y *= env_ad(n, 0.004, 0.25)
    for k in range(10):
        f = rng.uniform(500, 1400)
        b = glide(f, f * 1.8, 0.05) * env_ad(int(0.05 * SR), 0.002, 0.02)
        i = int(rng.uniform(0.05, 0.6) * SR)
        y[i:i + len(b)] += b * 0.5
    return norm(y, 0.7)


def s_drip():
    x = glide(700, 1700, 0.08) * env_ad(int(0.08 * SR), 0.002, 0.03)
    return norm(x, 0.35)


def s_coin_splash():
    a = s_splash()
    c = s_coin()
    a[: len(c)] += c * 0.8
    return norm(a, 0.7)


def s_drop():
    w = s_whoosh(0.4, 400, 2500, 0.25)
    th = partials([160, 380, 610], [1, 0.4, 0.2], [0.08, 0.05, 0.03], 0.4)
    out = np.zeros(int(0.9 * SR))
    out[: len(w)] += w
    i = int(0.35 * SR)
    out[i:i + len(th)] += th * 0.8
    i2 = int(0.55 * SR)
    out[i2:i2 + len(th)] += th[: len(out) - i2] * 0.3
    return norm(out, 0.6)


def s_sparkle():
    out = np.zeros(int(1.2 * SR))
    for k in range(14):
        f = rng.uniform(2500, 6000)
        p = partials([f], [1], [rng.uniform(0.05, 0.2)], 0.4)
        i = int(rng.uniform(0, 0.8) * SR)
        out[i:i + len(p)] += p * rng.uniform(0.3, 1)
    return norm(out, 0.22)


def s_flip():
    out = np.zeros(int(0.3 * SR))
    for k in range(3):
        c = hp(noise(0.02), 1500) * env_ad(int(0.02 * SR), 0.0005, 0.005)
        i = int(k * 0.06 * SR)
        out[i:i + len(c)] += c
    return norm(out, 0.45)


def s_register():
    out = np.zeros(int(1.3 * SR))
    c = s_flip()
    out[: len(c)] += c
    d = partials([2093, 2637, 3136], [1, 0.8, 0.6], [0.6, 0.5, 0.4], 1.0)
    i = int(0.18 * SR)
    out[i:i + len(d)] += d * 0.6
    return norm(out, 0.35)


def s_spot():
    x = partials([120, 240], [1, 0.3], [0.2, 0.1], 0.5)
    return norm(x, 0.4)


def s_flow(dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(noise(dur), 300, 1600) * (0.6 + 0.4 * np.sin(2 * np.pi * 5 * t)) * np.sin(np.pi * t / dur)
    return norm(x, 0.2)


def s_escalator(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    hum = (np.sin(2 * np.pi * 60 * t) + 0.4 * np.sin(2 * np.pi * 120 * t)) * 0.15
    out = hum
    k = 0.0
    while k < dur - 0.1:
        c = partials([900, 1400], [1, 0.5], [0.02, 0.01], 0.06)
        i = int(k * SR)
        out[i:i + len(c)] += c * 0.3
        k += 0.36
    fade = np.minimum(1, np.minimum(t / 0.3, (dur - t) / 0.4))
    return norm(out * fade, 0.22)


def s_boing():
    sec = 0.6
    n = int(sec * SR)
    t = np.arange(n) / SR
    f = 180 + 320 * (1 - np.exp(-t * 8)) + 40 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 4)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.003, 0.25)
    return norm(x, 0.4)


def s_run(dur=2.2):
    out = np.zeros(int((dur + 0.2) * SR))
    k = 0.0
    while k < dur:
        s = lp(noise(0.06), 900) * env_ad(int(0.06 * SR), 0.001, 0.015)
        i = int(k * SR)
        out[i:i + len(s)] += s
        k += 1 / 7
    return norm(out, 0.3)


def s_shimmer():
    out = np.zeros(int(1.6 * SR))
    for k, f in enumerate([1568, 1976, 2349, 2960, 3520]):
        p = partials([f], [1], [0.6], 1.0) * np.sin(np.pi * np.linspace(0, 1, SR))
        i = int(k * 0.08 * SR)
        out[i:i + len(p)] += p
    return norm(out, 0.2)


def s_news():
    out = np.zeros(int(1.2 * SR))
    for k, f in enumerate([440, 659.3, 880]):
        sec = 0.18 if k < 2 else 0.6
        t = T(sec)
        saw = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 8))
        s = lp(saw, 3000) * env_ad(len(t), 0.005, sec * 0.6)
        i = int(k * 0.16 * SR)
        out[i:i + len(s)] += s
    return norm(out, 0.3)


def s_outro():
    return s_shimmer() * 0.8


def s_machine(dur):
    """mechanical chugging loop for the money printer"""
    n = int(dur * SR)
    out = np.zeros(n + SR)
    k = 0.0
    beat = 0.19
    j = 0
    while k < dur:
        th = partials([85, 170], [1, 0.3], [0.05, 0.03], 0.15)
        cl = hp(noise(0.03), 2500) * env_ad(int(0.03 * SR), 0.0005, 0.006)
        i = int(k * SR)
        out[i:i + len(th)] += th * (1.0 if j % 2 == 0 else 0.6)
        if j % 2 == 1:
            out[i:i + len(cl)] += cl * 0.5
        k += beat
        j += 1
    t = np.arange(len(out)) / SR
    whirr = bp(noise(len(out) / SR), 400, 900) * 0.08
    out += whirr
    fade = np.clip(np.minimum(t / 0.5, (dur - t) / 0.6), 0, 1)
    return norm(out * fade, 0.2)


SYN = {
    "pop": s_pop, "clunk": s_clunk, "whoosh": s_whoosh, "swoosh_long": s_swoosh_long,
    "whoosh_down": s_whoosh_down, "scribble": s_scribble, "stamp": s_stamp, "thud": s_thud,
    "shine": s_shine, "ding": s_ding, "morph": s_morph, "coin": s_coin, "coins": s_coins,
    "boom": s_boom, "rise": s_rise, "press": s_press, "splash": s_splash, "drip": s_drip,
    "coin_splash": s_coin_splash, "drop": s_drop, "sparkle": s_sparkle, "flip": s_flip,
    "register": s_register, "spot": s_spot, "boing": s_boing, "shimmer": s_shimmer,
    "news": s_news, "outro": s_outro,
}

sfx_bus = np.zeros(N)
for ev in fx["sfx"]:
    typ, t0, g = ev["type"], ev["t"], ev["gain"]
    if typ == "machine_start":
        x = s_machine(ev["until"] - t0)
    elif typ in ("counter",):
        x = s_counter(ev.get("dur", 1.0))
    elif typ == "flow":
        x = s_flow(ev.get("dur", 1.2))
    elif typ == "escalator":
        x = s_escalator(ev.get("dur", 3.0))
    elif typ == "run":
        x = s_run(ev.get("dur", 2.0))
    elif typ in SYN:
        x = SYN[typ]()
    else:
        print("unknown sfx", typ)
        continue
    i = int(t0 * SR)
    if i >= N:
        continue
    L = min(len(x), N - i)
    sfx_bus[i:i + L] += x[:L] * g

# ------------------------------------------------------------------ music
BPM = 92
BEAT = 60 / BPM
BAR = BEAT * 4
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name, octave):
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)


CHORDS = {
    "Bm": ["B", "D", "F#"], "G": ["G", "B", "D"], "D": ["D", "F#", "A"], "A": ["A", "C#", "E"],
    "Em": ["E", "G", "B"], "F#": ["F#", "A#", "C#"], "Dsus": ["D", "G", "A"],
}
cue = {c["id"]: c for c in tl["cues"]}
first = {}
for c in tl["cues"]:
    first.setdefault(c["scene"], c["start"])
title_hit = cue["h7"]["start"]
end_title = cue["e2"]["end"] + 1.4

# sections: (start, progression, pad, pluck, bass, kick, hat, tick, bright)
SECTIONS = [
    (0.0, ["Bm", "G", "Em", "F#"], 0.55, 0.45, 0.35, 0.0, 0.0, 0.6, 0.0),
    (cue["h6"]["start"], ["Bm", "G", "Em", "F#"], 0.65, 0.6, 0.5, 0.45, 0.2, 0.6, 0.0),
    (title_hit, ["D", "A", "Bm", "G"], 0.5, 0.75, 0.45, 0.0, 0.2, 0.0, 1.0),
    (first["ripple"] - 0.8, ["G", "D", "Em", "D"], 0.75, 0.35, 0.3, 0.0, 0.0, 0.0, 0.3),
    (first["town"] - 0.5, ["D", "A", "Bm", "G"], 0.4, 0.85, 0.6, 0.45, 0.4, 0.0, 0.5),
    (first["modern"] - 0.5, ["Bm", "G", "D", "A"], 0.5, 0.75, 0.7, 0.65, 0.5, 0.0, 0.3),
    (first["you"] - 0.5, ["G", "D", "A", "Bm"], 0.6, 0.6, 0.5, 0.35, 0.3, 0.0, 0.3),
    (first["matters"] - 0.5, ["Bm", "G", "D", "A"], 0.8, 0.4, 0.5, 0.15, 0.1, 0.0, 0.2),
    (first["end"] - 0.5, ["Bm", "G", "D", "A"], 0.7, 0.85, 0.7, 0.7, 0.6, 0.0, 0.4),
    (end_title, ["D"], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
]


def section_at(t):
    s = SECTIONS[0]
    for x in SECTIONS:
        if t >= x[0]:
            s = x
    return s


def pluck(f, sec, bright):
    t = T(sec)
    out = np.zeros_like(t)
    for h in range(1, 11):
        a = 1 / h ** (1.3 - 0.6 * bright)
        d = 0.9 / (1 + 0.7 * (h - 1))
        out += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t / d)
    return out * env_ad(len(t), 0.003, 10)


mL = np.zeros(N)
mR = np.zeros(N)
pad = np.zeros(N)
bass = np.zeros(N)
drums = np.zeros(N)

bar_t = 0.0
bar_i = 0
# re-anchor the bar grid so a downbeat lands on the title hit
offset = title_hit % BAR
bar_t = offset - BAR * 1
while bar_t < DUR:
    sec = section_at(max(bar_t, 0))
    _, prog, g_pad, g_pl, g_bass, g_kick, g_hat, g_tick, bright = sec
    if bar_t >= end_title - 0.01:
        break
    chord = prog[bar_i % len(prog)]
    notes = CHORDS[chord]
    # pad: chord tones in octave 3/4
    if g_pad > 0 and bar_t + BAR > 0:
        ln = BAR + 1.6
        t = T(ln)
        e = np.clip(t / 0.7, 0, 1) * np.clip((ln - t) / 1.5, 0, 1)
        y = np.zeros_like(t)
        for k, nn in enumerate(notes + [notes[0]]):
            f = hz(nn, 3 if k < 3 else 4)
            for det in (-0.003, 0.003):
                for h in range(1, 5):
                    y += np.sin(2 * np.pi * f * (1 + det) * h * t + k) / h ** 1.6
        y *= e * g_pad
        i = int(bar_t * SR)
        a, b = max(0, i), min(N, i + len(y))
        pad[a:b] += y[a - i:b - i]
    # bass
    if g_bass > 0:
        f = hz(notes[0], 2)
        for bt in (0, 2):
            st = bar_t + bt * BEAT
            if st < 0:
                continue
            y = (np.sin(2 * np.pi * f * T(BEAT * 2)) + 0.25 * np.sin(4 * np.pi * f * T(BEAT * 2))) * env_ad(int(BEAT * 2 * SR), 0.01, 0.6) * g_bass
            i = int(st * SR)
            L = min(len(y), N - i)
            bass[i:i + L] += y[:L]
    # pluck arpeggio (8ths, sparse in the hook)
    if g_pl > 0:
        pattern = [0, 1, 2, 1, 3, 2, 1, 2]
        step = 2 if g_tick > 0 else 1
        for k in range(0, 8, step):
            st = bar_t + k * BEAT / 2
            if st < 0:
                continue
            idx = pattern[k]
            nn = notes[idx % 3]
            octv = 4 + (1 if idx == 3 else 0)
            y = pluck(hz(nn, octv), 1.2, bright) * g_pl * (0.8 if k % 2 else 1.0)
            i = int(st * SR)
            L = min(len(y), N - i)
            if L <= 0:
                continue
            mL[i:i + L] += y[:L] * 0.9
            mR[i:i + L] += y[:L] * 0.6
            # ping-pong echo
            for dly, gl, gr in ((BEAT * 0.75, 0.0, 0.35), (BEAT * 1.5, 0.22, 0.0)):
                j = i + int(dly * SR)
                L2 = min(len(y), N - j)
                if L2 > 0:
                    mL[j:j + L2] += y[:L2] * gl
                    mR[j:j + L2] += y[:L2] * gr
    # drums
    for bt in range(4):
        st = bar_t + bt * BEAT
        if st < 0:
            continue
        i = int(st * SR)
        if g_kick > 0 and bt in (0, 2):
            y = glide(110, 42, 0.3) * env_ad(int(0.3 * SR), 0.002, 0.11) * g_kick
            L = min(len(y), N - i)
            drums[i:i + L] += y[:L]
        if g_hat > 0:
            j = i + int(BEAT / 2 * SR)
            y = hp(noise(0.05), 7000) * env_ad(int(0.05 * SR), 0.0005, 0.012) * g_hat * 0.35
            L = min(len(y), N - j)
            if L > 0:
                drums[j:j + L] += y[:L]
        if g_tick > 0:
            y = partials([2900, 4400], [1, 0.4], [0.012, 0.008], 0.05) * g_tick * 0.35
            L = min(len(y), N - i)
            drums[i:i + L] += y[:L]
    bar_t += BAR
    bar_i += 1

# final chord on the end title
t0 = end_title
ln = DUR - t0 + 0.5
t = T(ln)
y = np.zeros_like(t)
for k, nn in enumerate(["D", "A", "F#", "D", "A"]):
    f = hz(nn, [2, 3, 4, 4, 4][k] + (1 if k == 3 else 0))
    for det in (-0.003, 0.003):
        for h in range(1, 5):
            y += np.sin(2 * np.pi * f * (1 + det) * h * t + k) / h ** 1.6
y *= np.clip(t / 0.05, 0, 1) * np.exp(-t / 2.2)
for k, nn in enumerate(["D", "F#", "A", "D"]):
    p = pluck(hz(nn, 5 if k < 3 else 6), 3.0, 0.7)
    j = int((t0 + k * 0.09) * SR)
    L = min(len(p), N - j)
    mL[j:j + L] += p[:L] * 0.5
    mR[j:j + L] += p[:L] * 0.5
i = int(t0 * SR)
L = min(len(y), N - i)
pad[i:i + L] += y[:L] * 0.9

pad = lp(pad, 1600)
music_L = mL * 0.55 + pad * 0.35 + bass * 0.9 + drums * 0.8
music_R = mR * 0.55 + pad * 0.35 + bass * 0.9 + drums * 0.8
# pad stereo widening via short delay on the right channel
d = int(0.012 * SR)
music_R[d:] += pad[:-d] * 0.12


def comb_reverb(x, delays=(1557, 1617, 1491, 1422), g=0.72, wet=0.18):
    out = np.zeros_like(x)
    for D in delays:
        y = x.copy()
        for s in range(D, len(y), D):
            e = min(s + D, len(y))
            y[s:e] += g * y[s - D:e - D]
        out += y
    return x + lp(out / len(delays), 4000) * wet


music_L = comb_reverb(music_L)
music_R = comb_reverb(music_R, delays=(1617, 1557, 1422, 1491))

# ducking under the narration
win = int(0.03 * SR)
v_env = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
sm = np.zeros_like(v_env)
a_att, a_rel = np.exp(-1 / (0.05 * SR)), np.exp(-1 / (0.5 * SR))
# one-pole smoother with separate attack/release (block-wise for speed)
blk = 480
lvl = 0.0
env_blocks = v_env[: len(v_env) // blk * blk].reshape(-1, blk).max(axis=1)
out_blocks = np.zeros_like(env_blocks)
for k, v in enumerate(env_blocks):
    coef = 0.5 if v > lvl else 0.93
    lvl = coef * lvl + (1 - coef) * v
    out_blocks[k] = lvl
sm[: len(out_blocks) * blk] = np.repeat(out_blocks, blk)
duck = 1 - 0.55 * np.clip(sm / 0.05, 0, 1)

m_rms = np.sqrt(np.mean(((music_L + music_R) / 2) ** 2)) or 1
music_gain = 0.016 / m_rms
music_L *= duck * music_gain
music_R *= duck * music_gain

# sound effects sit a bit under the voice, lightly ducked
sfx_bus = sfx_bus * (1 - 0.3 * np.clip(sm / 0.05, 0, 1)) * 0.45

L_out = voice + music_L + sfx_bus
R_out = voice + music_R + sfx_bus
mix = np.stack([L_out, R_out], axis=1)[: int(DUR * SR)]
# gentle fade at the very end
fade = int(1.2 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
peak = np.max(np.abs(mix))
mix = mix / peak * 0.95
sf.write(f"{B}/mix.wav", mix.astype(np.float32), SR, subtype="PCM_24")
sf.write(f"{B}/music_only.wav", (np.stack([music_L, music_R], 1)[: int(DUR * SR)] / peak).astype(np.float32), SR)
print("mix written", mix.shape[0] / SR, "s; music rms gain", round(music_gain, 3))
