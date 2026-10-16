# Proposal: drop-vendored-submodule

## Why

The repo carries `vendor/pi-blackhole` as a git submodule pinned at one upstream commit. A submodule pointer
travels in a push (it is a 1-line entry, not the 273 MB tree), but it buys the reader nothing: cloning the repo
does not fetch the copy, and the copy is not what runs — the running pi-blackhole is the one installed by
`pi install npm:pi-blackhole` in `~/.pi/agent/npm/`. So the pinned tree is a build-time convenience that the
published repo cannot express, and it leaves a dangling pointer for anyone who clones.

Measured sizes that make the choice concrete: `vendor/pi-blackhole` excluding `node_modules` and `.git` is
~6 MB / 345 entries (the built extension alone is 555 KB), against pi-web's 4,096-entry / 16 MiB package cap —
so bundling the pinned version is *possible*, it is simply not what was chosen.

## What Changes

- **Removed**: the `vendor/pi-blackhole` submodule entry and `.gitmodules`. The repo no longer names a pinned
  upstream copy.
- **Kept**: `vendor/pi-blackhole-bridge.patch` — the bridge is still published, because it is the part that
  carries the design and cannot be reconstructed from the plugin.
- **Kept, reworded**: `scripts/bridge.sh`. `apply` still refuses when the patch no longer fits the copy it is
  handed; `bump` stops re-pinning a submodule (there is nothing to pin) and instead refreshes a user-supplied
  upstream copy and runs the same fit check.
- **Unchanged**: `pi-web-plugin/` source, the bridge payload, the two panels, and the install path —
  `pi install npm:pi-blackhole` stays required, so the published install instructions do not change.

## Impact

- The published tree goes from 41 entries to 40: one `vendor/pi-blackhole` submodule entry and one `.gitmodules`
  file are removed.
- The bridge patch's provenance (the upstream version and commit it was derived against) moves from an implicit
  submodule pin into an explicit note in the patch header and the README.
- `scripts/bridge.sh bump` loses the guarantee that the copy it checks is the *same* copy the patch was derived
  against; it keeps the guarantee that a mismatch is refused loudly. That is the honest cost of this change.
- Nothing in the plugin reads the submodule, so no plugin revision churn and no daemon restart is caused by this
  change.

## Not changing

- No plugin source edits, no panel behaviour, no bridge channel names.
- No change to how pi-blackhole is installed or run.
