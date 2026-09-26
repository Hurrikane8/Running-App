#!/bin/bash
# Combine the silent render, the soundtrack and captions into the final MP4.
# usage: tools/mux.sh <video_silent.mp4> <mix.wav> <captions.srt> <out.mp4>
set -e
V=$1; A=$2; SUB=$3; OUT=$4
# normalise to -16 LUFS (typical for online video) with a static gain + limiter
I=$(ffmpeg -hide_banner -i "$A" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}')
GAIN=$(python3 -c "print(round(-16 - ($I), 2))")
echo "integrated loudness $I LUFS -> gain $GAIN dB"
ffmpeg -y -loglevel error -i "$V" -i "$A" -i "$SUB" \
  -map 0:v -map 1:a -map 2:s \
  -c:v copy \
  -af "volume=${GAIN}dB,alimiter=limit=0.89:level=false" -c:a aac -b:a 192k -ar 48000 \
  -c:s mov_text -metadata:s:s:0 language=eng -metadata:s:s:0 title=English \
  -metadata title="The Cantillon Effect" \
  -t "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")" -movflags +faststart "$OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128 -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2 || true
