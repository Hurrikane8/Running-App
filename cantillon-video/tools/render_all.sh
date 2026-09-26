#!/bin/bash
# Render the full video in parallel chunks, then join them losslessly.
# usage: tools/render_all.sh <out.mp4> [workers]
set -e
OUT=$1; K=${2:-3}; FPS=30
DIR=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
DUR=$(python3 -c "import json;print(json.load(open('$DIR/build/timeline.json'))['duration'])")
F=$(python3 -c "print(round($DUR*$FPS))")
pids=()
for ((k=0;k<K;k++)); do
  a=$(( F*k/K )); b=$(( F*(k+1)/K ))
  node "$DIR/tools/render.js" video "$TMP/part$k.mp4" $FPS $(python3 -c "print($a/$FPS)") $(python3 -c "print($b/$FPS)") > "$TMP/log$k.txt" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p; done
for ((k=0;k<K;k++)); do echo "file '$TMP/part$k.mp4'"; done > "$TMP/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy "$OUT"
tail -n 2 "$TMP"/log*.txt
rm -rf "$TMP"
