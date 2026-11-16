#!/usr/bin/env bash
set -euo pipefail

# Legacy TanStack Start modules remain temporarily for migration tests only.
# Production UI source must not import these modules or the Start runtime.
if grep -RInF \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  --exclude='*.test.ts' --exclude='*.spec.ts' \
  --exclude='auth-middleware.ts' --exclude='auth-attacher.ts' \
  -e '.functions' \
  -e '.server' \
  -e '@tanstack/react-start' \
  src; then
  echo "ERROR: production UI imports a legacy TanStack Start/server module."
  exit 1
fi

if grep -RInF \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.functions.ts' --exclude='*.server.ts' \
  --exclude='*.test.ts' --exclude='*.spec.ts' \
  --exclude='auth-middleware.ts' --exclude='auth-attacher.ts' \
  -e 'client.server' \
  -e 'supabaseAdmin' \
  -e 'SUPABASE_SERVICE_ROLE_KEY' \
  src; then
  echo "ERROR: server-only Supabase client or credentials referenced by production UI source."
  exit 1
fi

legacy_count=$({ find src -type f -name '*.functions.ts'; find src -type f -name '*.server.ts'; } | wc -l | tr -d ' ')
echo "OK: production UI is isolated from TanStack Start; ${legacy_count} legacy source files remain for test migration and deletion."
