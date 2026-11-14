#!/usr/bin/env bash
# Fails if the static build contains server-only markers. Usage: scripts/scan-dist-secrets.sh [dir]
DIR="${1:-dist}"; fail=0
for p in service_role SUPABASE_SERVICE_ROLE_KEY LOVABLE_API_KEY LOVABLE_CRON_SECRET INSTAGRAM_APP_SECRET YOUTUBE_API_KEY client.server sb_secret_; do
  if grep -rIl -- "$p" "$DIR" >/dev/null 2>&1; then echo "FOUND: $p"; fail=1; fi
done
[ $fail -eq 0 ] && echo "OK: no server-only markers in $DIR"; exit $fail
