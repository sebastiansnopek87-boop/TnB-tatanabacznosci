#!/usr/bin/env bash
set -Eeuo pipefail

# Scan client-facing build output, not Nitro's server bundle.
# Usage: scripts/scan-dist-secrets.sh <dist-or-.output/public>
DIR="${1:-dist}"

if [[ ! -d "$DIR" ]]; then
  echo "ERROR: build output directory does not exist: $DIR" >&2
  exit 2
fi

if ! find "$DIR" -type f -print -quit | grep -q .; then
  echo "ERROR: build output directory is empty: $DIR" >&2
  exit 2
fi

# Report file names and secret classes only. Never print matched values.
python3 - "$DIR" <<'PY'
import base64
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
direct_patterns = [
    ("Supabase secret API key", re.compile(rb"sb_secret_[A-Za-z0-9_-]{20,}")),
    ("Google API key", re.compile(rb"AIza[0-9A-Za-z_-]{30,}")),
    ("server-only credential variable", re.compile(
        rb"SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEYS?|LOVABLE_API_KEY|"
        rb"LOVABLE_CRON_SECRET|INSTAGRAM_APP_SECRET"
    )),
    ("server-only module reference", re.compile(rb"client\.server")),
]
legacy_jwt = re.compile(
    rb"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"
)

findings = []
scan_errors = []

for path in root.rglob("*"):
    if not path.is_file():
        continue

    try:
        data = path.read_bytes()
    except OSError:
        scan_errors.append(path)
        continue

    labels = []
    for label, pattern in direct_patterns:
        if pattern.search(data):
            labels.append(label)

    # Detect legacy Supabase service-role JWTs by decoding only their payload.
    for token in legacy_jwt.findall(data):
        try:
            payload = token.split(b".", 2)[1]
            payload += b"=" * (-len(payload) % 4)
            claims = json.loads(base64.urlsafe_b64decode(payload))
            if claims.get("role") == "service_role":
                labels.append("Supabase service-role JWT")
                break
        except (ValueError, TypeError, json.JSONDecodeError):
            continue

    for label in sorted(set(labels)):
        findings.append((path, label))

for path, label in findings:
    print(f"FOUND: {label}: {path}")

for path in scan_errors:
    print(f"ERROR: cannot read build output file: {path}", file=sys.stderr)

if findings or scan_errors:
    sys.exit(1)

print(f"OK: scanned client build output; no server-only credentials found in {root}")
PY
