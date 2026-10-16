#!/usr/bin/env bash
# Keep the vendored pi-blackhole and the web bridge in step.
#   ./scripts/bridge.sh apply   put the bridge on the local pi-blackhole copy (fetch it first)
#   ./scripts/bridge.sh bump    fetch upstream HEAD into that copy, then re-apply the bridge
set -euo pipefail
cd "$(dirname "$0")/.."
SUB=vendor/pi-blackhole
PATCH=vendor/pi-blackhole-bridge.patch

apply() {
  if ! git -C "$SUB" apply --check "$PATCH"; then
    echo "The bridge patch no longer fits the local pi-blackhole copy ($(git -C "$SUB" rev-parse --short HEAD))."
    echo "Re-derive vendor/pi-blackhole-bridge.patch against that commit before building."
    exit 1
  fi
  git -C "$SUB" apply "$PATCH"
  echo "bridge applied on pi-blackhole $(git -C "$SUB" rev-parse --short HEAD)"
}

bump() {
  git -C "$SUB" fetch origin
  git -C "$SUB" checkout origin/HEAD
  apply
}

case "${1:-apply}" in
  apply) apply ;;
  bump)  bump ;;
  *) echo "usage: ./scripts/bridge.sh apply|bump"; exit 1 ;;
esac
