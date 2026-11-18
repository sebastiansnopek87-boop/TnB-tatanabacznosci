#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

function_dirs=(supabase/functions/*)
dir_slugs=()
for dir in "${function_dirs[@]}"; do
  [[ -d "$dir" ]] || continue
  slug="${dir##*/}"
  # Shared helper modules are not deployable Edge Functions.
  [[ "$slug" == _* ]] && continue
  if [[ ! -f "$dir/index.ts" ]]; then
    echo "ERROR: $slug has no index.ts entrypoint in Git."
    exit 1
  fi
  dir_slugs+=("$slug")
done

mapfile -t sorted_dirs < <(printf '%s\n' "${dir_slugs[@]}" | sort)
mapfile -t config_slugs < <(sed -nE 's/^\[functions\.([a-z0-9-]+)\]$/\1/p' supabase/config.toml | sort)

if [[ "${#sorted_dirs[@]}" -eq 0 ]]; then
  echo "ERROR: No Supabase Edge Function sources found."
  exit 1
fi
if ! diff -u <(printf '%s\n' "${sorted_dirs[@]}") <(printf '%s\n' "${config_slugs[@]}"); then
  echo "ERROR: Edge Function source directories and supabase/config.toml sections differ."
  exit 1
fi

echo "OK: ${#sorted_dirs[@]} Edge Functions have tracked entrypoints and explicit config sections."
