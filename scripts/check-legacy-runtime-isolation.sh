#!/usr/bin/env bash
set -euo pipefail

# TanStack Start modules are temporarily retained for regression tests and
# migration reference only. They must not be imported by production UI source.
if grep -RInE \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  --exclude='*.test.ts' --exclude='*.spec.ts' \
  --exclude='auth-middleware.ts' --exclude='auth-attacher.ts' \
  -e "from[[:space:]]+['\"][^'\"]+\\.(functions|server)(\\.ts)?['\"]" \
  -e "import[[:space:]]*\\([[:space:]]*['\"][^'\"]+\\.(functions|server)(\\.ts)?['\"]" \
  -e "@tanstack/react-start" \
  src; then
  echo "ERROR: production application source imports a legacy TanStack Start/server module."
  exit 1
fi

# Service-role credentials and server-only clients must never enter production UI source.
if grep -RInE \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  --exclude='*.test.ts' --exclude='*.spec.ts' \
  --exclude='auth-middleware.ts' --exclude='auth-attacher.ts' \
  -e "client\\.server" \
  -e "supabaseAdmin" \
  -e "SUPABASE_SERVICE_ROLE_KEY" \
  src; then
  echo "ERROR: server-only Supabase client or credentials referenced by production UI source."
  exit 1
fi

legacy_count=$(find src -type f \\( -name '*.functions.ts' -o -name '*.server.ts' \\) | wc -l | tr -d ' ')
echo "OK: production UI is isolated from TanStack Start; ${legacy_count} legacy source files remain for test migration and deletion."
