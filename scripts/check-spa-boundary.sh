#!/usr/bin/env bash
set -euo pipefail

test -f index.html
test -f src/main.tsx
test -f src/router.tsx
test ! -e src/start.ts
test ! -e src/server.ts

if [[ -d src/routes/api ]] && find src/routes/api -type f -print -quit | grep -q .; then
  echo "ERROR: TanStack API route handlers remain under src/routes/api."
  exit 1
fi

if grep -RInE --include='*.ts' --include='*.tsx' '\b(useServerFn|createServerFn)\b' src/routes src/components; then
  echo "ERROR: UI still depends on TanStack server functions."
  exit 1
fi

if grep -RInE --include='*.ts' --include='*.tsx' '\.(functions|server)["'\'']' src/routes src/components; then
  echo "ERROR: UI imports legacy server modules directly."
  exit 1
fi

if grep -Eq 'tanstack/react-start|nitro|@lovable.dev/vite-tanstack-config' vite.config.ts; then
  echo "ERROR: Vite config still loads a server runtime or legacy build wrapper."
  exit 1
fi

node -e 'const p=require("./package.json"); const prod=p.dependencies||{}; const dev=p.devDependencies||{}; const bad=["@tanstack/react-start","nitro","@lovable.dev/vite-tanstack-config"].filter(k=>prod[k]); const unused=["nitro","@lovable.dev/vite-tanstack-config"].filter(k=>dev[k]); if(bad.length||unused.length){console.error("ERROR: SPA runtime dependencies are not clean:", [...bad,...unused].join(", ")); process.exit(1);}'

echo "OK: UI source is separated from TanStack server functions; Vite is configured for static SPA."
