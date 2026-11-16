#!/usr/bin/env bash
set -euo pipefail

# TanStack Start server modules may remain temporarily as rollback references,
# but no browser/runtime source may import them. Scan the complete application
# source tree rather than only routes/components.
if grep -RInE \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  '(from[[:space:]]+["'\'''][^"'\''']*\\.(functions|server)["'\''']|import[[:space:]]*\\([[:space:]]*["'\'''][^"'\''']*\\.(functions|server)["'\''']|@tanstack/react-start)' \
  src; then
  echo "ERROR: non-legacy application source imports a TanStack Start/server module."
  exit 1
fi

# A server-only Supabase client must never be referenced from browser code.
if grep -RInE \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  'client\\.server|supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY' \
  src; then
  echo "ERROR: server-only Supabase credentials/client referenced outside legacy server modules."
  exit 1
fi

legacy_count=$(find src -type f \\( -name '*.functions.ts' -o -name '*.server.ts' \\) | wc -l | tr -d ' ')
echo "OK: no browser source imports legacy server modules; $legacy_count legacy source files remain isolated for migration."
