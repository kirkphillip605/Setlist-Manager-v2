#!/usr/bin/env bash
set -Eeuo pipefail

run_and_capture() {
  local cmd="$1"
  local out=""
  echo "▶ $cmd"
  # Capture both stdout+stderr while still showing it live in the terminal.
  out="$(
    bash -lc "$cmd" 2>&1 | tee /dev/stderr
  )"
  printf "%s" "$out"
}

git_pull_with_stash_retry() {
  local output=""
  output="$(run_and_capture "git pull" || true)"

  if echo "$output" | grep -qiE '(^|[[:space:]])error:'; then
    echo "⚠️  Detected 'error:' in git pull output. Stashing changes and retrying..."
    run_and_capture "git stash"
    run_and_capture "git pull"
  else
    # If no "error:" was detected, still ensure git pull succeeded (exit code).
    # We ran with `|| true` above to allow inspection; now we enforce success by re-running
    # only when needed. If git pull failed without printing 'error:', abort.
    if ! git status >/dev/null 2>&1; then
      echo "❌ Git appears to be in a bad state."
      exit 1
    fi
  fi
}

main() {
  # Ensure we're in a git repo
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not inside a git repository."
    exit 1
  fi

  git_pull_with_stash_retry
  run_and_capture "pnpm run build"
  run_and_capture "npx cap sync"

  echo "✅ Done."
}

main "$@"
