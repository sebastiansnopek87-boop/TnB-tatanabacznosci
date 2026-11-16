#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path
import re

root = Path("src")
legacy_suffixes = (".functions.ts", ".server.ts")
# Only these two integration suites still exercise Start handlers behind mocks.
# Keep the exception explicit so new tests cannot silently import legacy code.
legacy_test_allowlist = {
    Path("lib/control-center-360.test.ts"),
    Path("lib/legal-pages.test.ts"),
}
# These generated TanStack middleware files are retained only as migration
# inventory. They are not part of the Vite SPA entry graph.
retained_legacy = {
    Path("integrations/supabase/auth-middleware.ts"),
    Path("integrations/supabase/auth-attacher.ts"),
}
static_or_dynamic_import = re.compile(
    r"""(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']""",
    re.MULTILINE,
)
forbidden_import = re.compile(r"""(?:\.functions|\.server)$|@tanstack/react-start""")
server_only = re.compile(r"""\b(?:client\.server|supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY)\b""")

errors = []
legacy_count = 0
for path in root.rglob("*"):
    if not path.is_file() or path.suffix not in (".ts", ".tsx", ".js", ".jsx"):
        continue

    relative = path.relative_to(root)
    if path.name.endswith(legacy_suffixes) or relative in retained_legacy:
        legacy_count += 1
        continue

    if relative in legacy_test_allowlist:
        continue

    source = path.read_text(errors="replace")
    for match in static_or_dynamic_import.finditer(source):
        target = match.group(1)
        if forbidden_import.search(target):
            line = source[:match.start()].count(chr(10)) + 1
            errors.append(f"{path}:{line}: legacy runtime import {target}")

    for match in server_only.finditer(source):
        line = source[:match.start()].count(chr(10)) + 1
        errors.append(f"{path}:{line}: server-only Supabase reference")

if errors:
    print(chr(10).join(errors))
    raise SystemExit("ERROR: browser/application source references legacy server runtime.")

print(
    f"OK: no browser/application source imports legacy server modules; "
    f"{legacy_count} retained legacy source files remain isolated for migration."
)
PY
