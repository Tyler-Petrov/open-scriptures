#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 path/to/app.apk" >&2
  exit 2
fi

apk_path=$1
if [[ ! -f "$apk_path" ]]; then
  echo "APK not found: $apk_path" >&2
  exit 2
fi

for tool in readelf unzip zipinfo; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required tool not found: $tool" >&2
    exit 2
  fi
done

zipalign_bin=${ZIPALIGN:-}
if [[ -z "$zipalign_bin" ]]; then
  zipalign_bin=$(command -v zipalign || true)
fi
if [[ -z "$zipalign_bin" || ! -x "$zipalign_bin" ]]; then
  echo "Set ZIPALIGN to an executable from Android SDK Build-Tools 35 or newer." >&2
  exit 2
fi

if ! "$zipalign_bin" -c -P 16 4 "$apk_path"; then
  echo "FAIL: APK native libraries are not 16 KB ZIP-aligned." >&2
  exit 1
fi

mapfile -t shared_libraries < <(
  zipinfo -1 "$apk_path" | grep -E '^lib/(arm64-v8a|x86_64)/.*\.so$'
)

if [[ ${#shared_libraries[@]} -eq 0 ]]; then
  echo "FAIL: APK contains no 64-bit native libraries to inspect." >&2
  exit 1
fi

tmp_so=$(mktemp)
trap 'unlink "$tmp_so" 2>/dev/null || true' EXIT

failures=0
for library_path in "${shared_libraries[@]}"; do
  unzip -p "$apk_path" "$library_path" > "$tmp_so"
  mapfile -t load_alignments < <(
    readelf -lW "$tmp_so" | awk '$1 == "LOAD" { print $NF }'
  )

  if [[ ${#load_alignments[@]} -eq 0 ]]; then
    echo "FAIL: could not read ELF LOAD segments from $library_path" >&2
    failures=1
    continue
  fi

  for alignment in "${load_alignments[@]}"; do
    if (( alignment < 0x4000 )); then
      echo "FAIL: $library_path has ELF LOAD alignment $alignment; expected at least 0x4000." >&2
      failures=1
      break
    fi
  done
done

if (( failures != 0 )); then
  exit 1
fi

echo "PASS: ${#shared_libraries[@]} 64-bit native libraries are 16 KB ZIP- and ELF-aligned."
