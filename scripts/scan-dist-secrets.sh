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

markers=(
  service_role
  SUPABASE_SERVICE_ROLE_KEY
  LOVABLE_API_KEY
  LOVABLE_CRON_SECRET
  INSTAGRAM_APP_SECRET
  client.server
  'sb_secret_[A-Za-z0-9_-]{20,}'
  'AIza[0-9A-Za-z_-]{35}'
  '(sk|rk)_(live|test)_[A-Za-z0-9]{16,}'
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
)

failed=0
for marker in "${markers[@]}"; do
  if matches="$(grep -rIlE -- "$marker" "$DIR" 2>&1)"; then
    echo "FOUND: $marker"
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

if [[ $failed -eq 0 ]]; then
  echo "OK: no server-only markers or credential values in $DIR"
fi

exit "$failed"
