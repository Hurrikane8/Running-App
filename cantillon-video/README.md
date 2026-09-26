# The Cantillon Effect: animated explainer

By Kane Gulka ft. Opus 5.5.

A 2D animated explainer about the Cantillon effect: why *who gets new money first* matters, and how it affects ordinary people. It comes in two cuts:

| Cut | File | Format | Length |
|-----|------|--------|--------|
| Full | `the-cantillon-effect.mp4` | 16:9, 1920×1080 | 3:41 |
| Vertical short (Shorts, Reels, TikTok) | `the-cantillon-effect-vertical.mp4` | 9:16, 1080×1920 | 1:34 |

Both files are 30 fps with AAC stereo at −16 LUFS and an optional English caption track. The captions are also provided as `.srt` files. To scrub through either animation frame by frame, open `index.html` (full cut) or `short.html` (vertical cut) in a browser.

## Style

Flat 2D vector illustration with continuous "vector merge" transitions and no hard cuts. Each scene turns into the next:

| # | Scene | How it turns into the next scene |
|---|-------|----------------------------------|
| 1 | **Hook:** a money-printing machine and "Who gets it first?" | The machine and the people in line melt into three circles (rent, savings, the gap), which fuse into a gold coin with the title |
| 2 | **Richard Cantillon, Paris 1720:** a portrait, the paper-money press and a magnifying glass | The coin flips into Cantillon's portrait frame. Later the magnifying glass grows into a diagram of the economy |
| 3 | **Pond ripple:** new money enters at one point | The diagram's lens becomes a pond, and its gold entry point becomes a falling drop |
| 4 | **Tiny town:** banker, builder, shopkeeper, teacher and retiree; bread goes from $1 to $2 | The camera tilts from the top-down pond to a side view of the town |
| 5 | **Today's world:** central bank, then banks and government, then assets, then businesses, then wages; plus the 2020 chart | The townspeople morph into the pipeline's nodes and the ground becomes the money pipe. The pipe then collapses into the chart's axis and the nodes shrink into its legend |
| 6 | **What it means for you:** paycheck, the leaky savings jar, the down escalator, the runaway house, the gap | The end of the wages line becomes "you". The jar morphs into the escalator, and the escalator into the ground |
| 7 | **Why it matters:** not a conspiracy; inflation is a transfer; three better questions | The screen dives into "the gap" |
| 8 | **Ending:** "Don't just ask how much. Ask who gets it first." | The question cards reassemble into the opening machine, and everything merges into the title coin |

## The vertical cut

The vertical cut is a tighter script (`script_short.json`) re-composed for a phone screen, not a crop of the full version. Its scenes are in `src/short.js`:

- The line of people becomes a hillside staircase of houses that the new money cascades down.
- The money pipeline flows from top to bottom.
- Key content stays inside the area that app overlays don't cover (roughly y 180–1560).

## How it's made

Everything is generated from code. There are no stock assets.

- **Narration:** [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) neural text-to-speech (voice `af_heart`), run locally from `script.json` (`tools/tts.py`). Per-word timings are estimated from phoneme counts (`tools/words.py`) so animation beats land on specific words.
- **Animation:** a small deterministic canvas engine (`src/engine.js`) with polygon shape-morphing for the vector-merge transitions. Characters and props are in `src/art.js` and the choreography is in `src/scenes.js`. Every frame is a pure function of time.
- **Rendering:** headless Chromium via Playwright renders the frames, which are piped into ffmpeg/x264 (`tools/render.js`, `tools/render_all.sh`).
- **Sound:** the music bed (92 BPM, with sections that follow the story), about 140 synthesized sound effects, and ducking under the voice are all generated with numpy/scipy (`tools/audio.py`). The final mix is normalised to −16 LUFS (`tools/mux.sh`).

### Rebuild

```bash
# requirements: node 18+, python 3.10+, ffmpeg, Chromium (playwright-core)
pip install kokoro-onnx soundfile numpy scipy
npm install                      # playwright-core
# Kokoro model files (from the kokoro-onnx GitHub releases):
#   kokoro-v1.0.onnx, voices-v1.0.bin  -> $MODELS

mkdir -p build
python3 tools/tts.py   script.json $MODELS/kokoro-v1.0.onnx $MODELS/voices-v1.0.bin build
python3 tools/words.py build/timeline.json $MODELS/kokoro-v1.0.onnx $MODELS/voices-v1.0.bin src/timeline.js
node tools/render.js sfx build/sfx.json
python3 tools/audio.py build
python3 tools/make_srt.py build/timeline.json build/captions.srt
tools/render_all.sh build/video_silent.mp4 3
tools/mux.sh build/video_silent.mp4 build/mix.wav build/captions.srt the-cantillon-effect.mp4
```

To check a single frame, run `node tools/render.js stills <dir> 12.5,40,95`.

To build the vertical cut, use the same steps with the vertical script and page:

```bash
mkdir -p build_short
python3 tools/tts.py   script_short.json $MODELS/kokoro-v1.0.onnx $MODELS/voices-v1.0.bin build_short
python3 tools/words.py build_short/timeline.json $MODELS/kokoro-v1.0.onnx $MODELS/voices-v1.0.bin src/timeline_short.js
PAGE=short.html node tools/render.js sfx build_short/sfx.json
python3 tools/audio.py build_short script_short.json
python3 tools/make_srt.py build_short/timeline.json the-cantillon-effect-vertical.srt
BUILD=build_short PAGE=short.html tools/render_all.sh build_short/video_silent.mp4 4
tools/mux.sh build_short/video_silent.mp4 build_short/mix.wav the-cantillon-effect-vertical.srt the-cantillon-effect-vertical.mp4
```

The fonts in `fonts/` (Fraunces, Inter and Caveat) are licensed under the SIL Open Font License.

## A note on the 2020 chart

The 2020–2023 chart in scene 5 is **illustrative**. Its curves are stylised from U.S. data (M2 money supply, S&P 500, CPI, average hourly earnings) to show the *order* in which things moved: new money, then stock prices, then consumer prices, with wages last. It is not an exact plot. The narration's claims are the well-documented ones:

- The U.S. money supply grew by trillions of dollars in 2020.
- The S&P 500 set new record highs by August 2020.
- Inflation picked up in 2021–22.
- Real wages fell year over year for roughly two years (2021–2023).
