# Proposal

## Why

pi-blackhole's `statusBar` setting ("Footer status bar", description: *Show token
gauges (O/P/X) and worker events in the footer*) has no observable effect in pi-web:
hosted sessions are handed `hasUI: false`, so the terminal footer the setting controls
is never drawn and the setting is inert in both states. Meanwhile the pi-web status
panel — which is pi-blackhole's equivalent of that footer — stays live regardless of the
setting, so a user who turns `statusBar` off still sees the readout, and a user reading
the settings panel cannot tell that the switch does nothing where they are.

## What Changes

- **MODIFIED**: the pi-web status bar honours `statusBar`. When pi-blackhole reports the
  setting off, the status panel stops showing the gauges and says why, naming the setting.
- **ADDED**: the plugin reads the setting's effective value from pi-blackhole's own
  settings payload — it does not own, default, or restate the field.
- **ADDED**: turning the switch off is self-explaining rather than a blank panel.
- **UNCHANGED**: the tab stays present in both states.
- **SCOPE**: every edit lands in `pi-web-plugin/` only. pi-blackhole's source, the
  vendored bridge patch, and the published npm runtime are not touched; no bridge
  extension, no patch bump, no npm release.

## Capabilities

### New Capabilities

(none — this refines the existing capability)

### Modified Capabilities

- `pi-blackhole-settings`: the requirement that the status bar shows the measured gauges
  gains a condition, and the switch that governs it is specified as read-from-pi-blackhole
  rather than owned by the plugin.

## Impact

- `pi-web-plugin/src/browser/index.js` — the status panel render path gains a gate and an
  off-state notice; the status panel gains a settings read it does not do today.
- No change to `pi-web-plugin/src/server.js`, the bridge, `vendor/pi-blackhole`, or
  `scripts/bridge.sh`. The published pi-blackhole runtime keeps behaving exactly as it
  does now; only the panel's reading of it changes.
- Revision churn: any browser-module edit changes the package revision, so activating it
  needs a session-daemon restart plus a browser reload (established constraint).
- The vitest suite still cannot run (installed `pi-codemode@1.2.0` lacks
  `MCP_TYPESCRIPT_PREAMBLE`, which `src/om/tokens.ts` imports). Verification stays
  harness-plus-end-to-end, and that limitation stays visible.
