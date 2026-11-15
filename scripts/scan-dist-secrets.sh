#!/usr/bin/env bash
set -Eeuo pipefail

# Scan only client-facing build output. For a future static SPA this is dist/;
# while TanStack Start is still active, it is .output/public/.
DIR="${1:-dist}"

if [[ ! -d "$DIR" ]]; then
  echo "ERROR: build output directory does not exist: $DIR" >&2
  exit 2
fi

if ! find "$DIR" -type f -print -quit | grep -q .; then
  echo "ERROR: build output directory is empty: $DIR" >&2
  exit 2
fi

# These identifiers suggest server-only source was included in the client bundle.
# Do not match public UI copy such as the name YOUTUBE_API_KEY.
markers=(
  service_role
  SUPABASE_SERVICE_ROLE_KEY
  LOVABLE_API_KEY
  LOVABLE_CRON_SECRET
  INSTAGRAM_APP_SECRET
  client.server
)

failed=0
for marker in "${markers[@]}"; do
  if matches="$(grep -rIlF -- "$marker" "$DIR" 2>&1)"; then
    echo "FOUND server-only marker: $marker"
    printf '%s\n' "$matches"
    failed=1
  else
    status=$?
    if [[ $status -gt 1 ]]; then
      echo "ERROR: failed scanning $DIR for marker: $marker" >&2
      printf '%s\n' "$matches" >&2
      failed=1
    fi
  fi
done

# Detect complete credential-shaped values; SDKs may legitimately contain key prefixes.
credential_patterns=(
  'sb_secret_[A-Za-z0-9_-]{20,}'
  'AIza[0-9A-Za-z_-]{30,}'
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'
)
for pattern in "${credential_patterns[@]}"; do
  if matches="$(grep -rIlE -- "$pattern" "$DIR" 2>&1)"; then
    echo "FOUND credential-shaped value"
    printf '%s\n' "$matches"
    failed=1
  else
    status=$?
    if [[ $status -gt 1 ]]; then
      echo "ERROR: failed scanning $DIR for credential-shaped values." >&2
      printf '%s\n' "$matches" >&2
      failed=1
    fi
  fi
done

if [[ $failed -eq 0 ]]; then
  echo "OK: no server-only markers or credential-shaped values in $DIR"
fi

exit "$failed"
