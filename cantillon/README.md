# The Cantillon Effect

A 69-second vertical (9:16) motion-graphics explainer with a narrator, built as
one self-contained HTML file: [`index.html`](index.html). No network, no libraries,
no files next to it. The fonts, the narrator's voice and the code are all inside.

> *Nobody touched your money. So why is it shrinking?*

The story is one continuous camera move through a single world. It starts on
your savings sealed in a vitrine and follows the value leaking out of it up to a
300-year-old idea. From there it goes back to Paris in 1720, where John Law's
press prints banknotes and Richard Cantillon gets rich, and down a line of people
as new money tumbles from ledge to ledge while bread prices climb. The line then
folds into a chart of assets against wages, the chart swells into a wave, and
everyone ends up queued under the tap. The last frame is identical to the first,
so the video loops seamlessly.

## Record it

1. Open `index.html` in Chrome, Safari or Firefox (double-click works; after
   merging, GitHub Pages also serves it at `/cantillon/`).
2. Start your screen recorder.
3. **Tap anywhere** (or press <kbd>Space</kbd>). Browsers only allow sound after
   a tap, so playback starts on it. Nothing else is ever drawn on screen. The
   cursor hides and the video ends on its opening frame, ready to trim.

Getting an exact 1080×1920 capture:

- **Desktop Chrome:** open DevTools, turn on the device toolbar, choose
  *Responsive* and set **1080 × 1920** (DPR 1) or **540 × 960** (DPR 2), then
  record the tab. On a landscape window the page shows a clean 9:16 column with
  nothing peeking in from the sides.
- **Phone:** open the file and start the system screen recorder, then tap. Taller
  phones show a little extra background above and below the 9:16 frame. Crop to
  9:16 when editing.

Headlines and labels stay clear of the TikTok, Reels and Shorts interface
zones (top bar, caption area, side buttons).

### Hidden controls

| Key | Action |
| --- | --- |
| Tap, <kbd>Space</kbd>, <kbd>Enter</kbd> | Play, pause, resume |
| <kbd>R</kbd> | Restart |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek 5 seconds |
| <kbd>C</kbd> | Toggle word-by-word captions |
| <kbd>M</kbd> | Mute |
| <kbd>F</kbd> | Fullscreen |

### Options

Add these to the URL as `#token` (or `?token`):

| Option | Effect |
| --- | --- |
| `#captions` | Burned-in captions, highlighted as each word is spoken |
| `#nomusic` | Drop the score, e.g. to add a platform sound later |
| `#nosfx` | Drop the sound effects |
| `#novoice` | Drop the narrator, to record your own voice-over on the same timing |
| `#nograin` | Turn off the film grain (smaller, cleaner screen recordings) |
| `#autoplay` | Start without a tap (silent unless the browser allows autoplay) |
| `?t=42` | Start at 42 seconds |

### Or skip recording: export an MP4

`node tools/export.mjs cantillon-effect.mp4` renders every frame at
1080×1920 and 60 fps, straight from the timeline, and muxes the offline audio
mix. The result is an H.264/AAC MP4, frame-perfect and in sync, ready to upload.
It needs Playwright's Chromium and `ffmpeg` (set `FFMPEG=/path/to/ffmpeg` if it
isn't on your `PATH`) and takes a few minutes.

## Script

| Time | Narration |
| ---: | --- |
| 0:00 | Nobody touched your money. So why is it shrinking? |
| 0:04 | Follow the leak, and you'll find a three-hundred-year-old idea: the Cantillon Effect. |
| 0:10 | In 1720, Paris was printing paper money like crazy. A banker named Richard Cantillon got rich from it... and then figured out why. |
| 0:20 | New money never reaches everyone at once. It pours in at one spot... and flows down the line. |
| 0:26 | Whoever gets it first can spend it at today's prices. But all that spending pushes prices up. |
| 0:32 | So the next person gets the money... after things already cost more. By the time it reaches the end of the line, usually your paycheck, prices have already climbed. |
| 0:42 | Same money. Less stuff. |
| 0:44 | Today, new money mostly enters through banks and financial markets. So stocks and homes tend to rise first... and wages, last. |
| 0:53 | Own assets? You ride the wave. Don't? You chase it. |
| 0:57 | Nobody stole anything. The winners just stand closer to the tap. |
| 1:01 | So whenever new money appears, ask one question: who gets it first? |

## How it works

- **Every frame is a pure function of time.** `render(t)` draws the whole frame
  from `t` alone, with no accumulated state. Motion is identical at 30, 60 or
  120 Hz, and any moment can be rendered on demand.
- **The narrator's clock is the master clock.** Playback reads the
  `AudioContext` output timestamp, compensated for output latency, so picture and
  voice can't drift. Every animation beat is pinned to a spoken word's timestamp
  (`src/audio/timing.json`), so re-recording the voice re-times the picture.
- **Narrator:** [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0),
  voice `af_heart`, rendered offline and embedded as a 64 kbps MP3. Word timings
  come from the model's own phoneme durations: the ONNX export is patched to
  expose them.
- **Score and effects** are synthesized live with Web Audio: an A-minor bed that
  ducks under the voice, a harpsichord for 1720, coin clinks, whooshes, and a
  riser into the title. The mix measures about −13 LUFS with a −1.4 dBFS true peak.
- **Look:** a midnight-treasury palette (gold for new money, mint for you, coral
  for prices), Bricolage Grotesque for kinetic type and IM Fell English for 1720.
  Scene changes are all continuous: particles re-form into new words, the skyline
  folds flat like a pop-up book into the ledges, the ledges slide into a chart
  axis, and the asset line swells into a wave.

## Edit and rebuild

```sh
python3 tools/build.py          # after editing anything in src/ (no dependencies)
```

`src/js/*.js` is concatenated in filename order: `00-core` (math, canvas,
camera), `10-draw` (props and characters), `20-type` (kinetic type),
`30-timeline` (cues and camera path), then one file per act, `85-audio` and
`95-main` (clock, input, loop).

To change the narration, edit `src/narration.json` and re-voice it:

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install kokoro-onnx onnx soundfile imageio-ffmpeg "misaki[en]"
python3 -m spacy download en_core_web_sm
python3 tools/narrate.py && python3 tools/build.py   # fetches the model on first run
```

Tooling (needs Playwright's Chromium):

```sh
node tools/snap.mjs frames/ 0 9.5 30   # render frames at given seconds
node tools/mix.mjs mix.wav             # render the full soundtrack offline
node tools/live.mjs out/               # real-time playback smoke test
node tools/perf.mjs                    # per-second frame cost
node tools/export.mjs out.mp4          # frame-perfect 1080x1920 60 fps MP4
```

## Notes on the history

- Richard Cantillon (1680s–1734) was an Irish-born banker in Paris who made a
  fortune during John Law's Mississippi scheme (1719–1720). See Antoin E. Murphy,
  *Richard Cantillon: Entrepreneur and Economist* (1986).
- His *Essai sur la Nature du Commerce en Général* (written around 1730,
  published 1755) describes how new money raises prices first where it is first
  spent. The short-run winners are whoever receives it early.
- The Paris skyline shows Notre-Dame with its medieval spire, which stood until
  1786. The banknotes are *billets de banque* for *dix livres*.
- Bread prices and the assets-versus-wages chart are illustrative, not data.
