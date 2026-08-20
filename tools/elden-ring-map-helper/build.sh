#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUTPUT_DIR="$SCRIPT_DIR/bin"
COMPILER=${MCS:-/Library/Frameworks/Mono.framework/Versions/Current/bin/mcs}

mkdir -p "$OUTPUT_DIR"
"$COMPILER" \
  -nologo \
  -optimize+ \
  -platform:x64 \
  -target:exe \
  -out:"$OUTPUT_DIR/EldenRingMapHelper.exe" \
  "$SCRIPT_DIR/EldenRingMapHelper.cs"

"$COMPILER" \
  -nologo \
  -optimize+ \
  -platform:x64 \
  -target:exe \
  -out:"$OUTPUT_DIR/EldenRingHotkeyHelper.exe" \
  "$SCRIPT_DIR/EldenRingHotkeyHelper.cs"

echo "$OUTPUT_DIR/EldenRingMapHelper.exe"
echo "$OUTPUT_DIR/EldenRingHotkeyHelper.exe"
