# Proposal: pi-blackhole-settings-plugin

## Why

pi-blackhole keeps its settings surface and its O/P/X status bar inside the terminal plugin; from the pi-web browser there is no way to change a setting or watch the gauges without asking the model. This change adds that surface to pi-web without duplicating pi-blackhole's settings schema.

## What Changes

- Add a pi-web plugin (browser API v4 + server API v3) with two workspace panels: a settings form and an O/P/X status bar.
- Vendor pi-blackhole as a pinned git submodule (`vendor/pi-blackhole`) and carry a bridge patch applied onto that pinned copy, plus `scripts/bridge.sh` to keep the two in step.
- The bridge adds three read-only additions to the pinned pi-blackhole copy: `ConfigManager.getFields`, `publishGauges()` in the status-bar subsystem, and `src/om/web-bridge.ts` answering `pi-blackhole-web:settings` frames.
- The plugin never restates a setting key, option list, numeric range, or config path: schema, values, provenance, validation, saving and gauge measurement all come from pi-blackhole over the session event bus.
- New capability `pi-blackhole-settings`. No existing capability's requirements change. No changes to pi-web itself.

## Capabilities

### New Capabilities

- `pi-blackhole-settings`: settings and gauge surfaces in pi-web that are served by pi-blackhole itself, so the web surface cannot drift from the terminal settings surface.

### Modified Capabilities

- None. The plugin adds new behavior; no existing capability's requirements change.

## Impact

- New code: `pi-web-plugin/` (browser entry, server entry), the `vendor/pi-blackhole` submodule pin, `vendor/pi-blackhole-bridge.patch`, `scripts/bridge.sh`.
- Modified code: the pinned pi-blackhole copy only — `index.ts`, `src/om/status-bar.ts`, `src/pi-base/config-manager.ts`, plus the new `src/om/web-bridge.ts`. Upstream pi-blackhole sources are untouched; the edits land on a pinned checkout.
- Runtime: the panels talk to the hosted Pi session over its event bus (`pi-blackhole-web:settings`, `pi-blackhole:gauges`); opening a panel sends no message to the model.
- Config: writes go through pi-blackhole's `ConfigManager.save` at global/project/session scope; the plugin never names a config path.
