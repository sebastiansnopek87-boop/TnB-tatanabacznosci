#!/usr/bin/env bash
set -euo pipefail

# Legacy TanStack Start modules remain only as isolated migration references.
# No non-legacy source file may import them.
if grep -RInE \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  -e "from[[:space:]]+['\"][^'\"]+\\.(functions|server)(\\.ts)?['\"]" \
  -e "import[[:space:]]*\\([[:space:]]*['\"][^'\"]+\\.(functions|server)(\\.ts)?['\"]" \
  -e "@tanstack/react-start" \
  src; then
  echo "ERROR: application source imports a legacy TanStack Start/server module."
  exit 1
fi

# Service-role credentials and server-only clients must never enter browser source.
if grep -RInE \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  -e "client\\.server" \
  -e "supabaseAdmin" \
  -e "SUPABASE_SERVICE_ROLE_KEY" \
  src; then
  echo "ERROR: server-only Supabase client or credentials referenced outside legacy server modules."
  exit 1
fi

legacy_count=$(find src -type f \\( -name '*.functions.ts' -o -name '*.server.ts' \\) | wc -l | tr -d ' ')
echo "OK: no browser source imports legacy server modules; ${legacy_count} legacy source files remain isolated for migration."
