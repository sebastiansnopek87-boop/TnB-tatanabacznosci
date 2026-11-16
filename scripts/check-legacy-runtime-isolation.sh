#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path
import re
root = Path("src")
legacy_suffixes = (".functions.ts", ".server.ts")
import_pattern = re.compile(r"""(?:from\s*|import\s*\(\s*)["']([^"']+)["']""")
forbidden = re.compile(r"""(?:\.functions|\.server)$|@tanstack/react-start""")
server_only = re.compile(r"""client\.server|supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY""")
errors = []
legacy_count = 0
for path in root.rglob("*"):
    if not path.is_file() or path.suffix not in (".ts", ".tsx"):
        continue
    if path.name.endswith(legacy_suffixes):
        legacy_count += 1
        continue
    source = path.read_text(errors="replace")
    for number, line in enumerate(source.splitlines(), 1):
        for match in import_pattern.finditer(line):
            if forbidden.search(match.group(1)):
                errors.append(f"{path}:{number}: legacy runtime import {match.group(1)}")
        if server_only.search(line):
            errors.append(f"{path}:{number}: server-only Supabase reference")
if errors:
    print("\n".join(errors))
    raise SystemExit("ERROR: browser/application source references legacy server runtime.")
print(f"OK: no browser source imports legacy server modules; {legacy_count} legacy source files remain isolated for migration.")
PY
