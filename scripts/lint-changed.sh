#!/usr/bin/env bash
set -euo pipefail

# Keep the CI lint gate actionable while the legacy repository-wide formatting
# backlog is being resolved in batches. PRs lint the full PR diff; pushes lint
# the pushed commit range. Semantic ESLint rules remain enabled.
BASE_SHA=""
if [[ "${EVENT_NAME:-}" == "pull_request" ]]; then
  BASE_SHA="${PR_BASE_SHA:-}"
else
  BASE_SHA="${EVENT_BEFORE:-}"
fi

if [[ -z "$BASE_SHA" || "$BASE_SHA" =~ ^0+$ ]] || ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  BASE_SHA="$(git rev-parse HEAD^ 2>/dev/null || true)"
fi

if [[ -z "$BASE_SHA" ]]; then
  BASE_SHA="$(git hash-object -t tree /dev/null)"
fi

mapfile -t CHANGED_PATHS < <(git diff --name-only --diff-filter=ACMR "$BASE_SHA" "${GITHUB_SHA:-HEAD}")
FILES=()
for path in "${CHANGED_PATHS[@]}"; do
  case "$path" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      [[ -f "$path" ]] && FILES+=("$path")
      ;;
  esac
done

if [[ "${#FILES[@]}" -eq 0 ]]; then
  echo "No changed JavaScript/TypeScript source files to lint."
  exit 0
fi

printf 'Linting %s changed source file(s).\n' "${#FILES[@]}"
bunx eslint --rule '{"prettier/prettier":"off"}' --no-error-on-unmatched-pattern "${FILES[@]}"
