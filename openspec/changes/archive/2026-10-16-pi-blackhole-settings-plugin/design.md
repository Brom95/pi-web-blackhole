# Design: pi-blackhole-settings-plugin

## Context

See `proposal.md` — Why. The constraint that shapes the approach: installed pi-blackhole ships as one bundled `dist/index.js`. There is no importable `ConfigManager` singleton and no subpath to the settings modules, so a wrapper living outside pi-blackhole cannot reach the settings schema, the merged values, or the measured gauges. The bridge therefore has to be part of pi-blackhole itself, where that state already lives.

## Goals / Non-Goals

**Goals:**

- One source of truth: the web surface cannot drift from the terminal settings surface.
- Opening or refreshing a panel sends no message to the model.
- The vendored copy stays pinned and provably in step with the bridge.

**Non-Goals:**

- Changing pi-web.
- Changing upstream pi-blackhole sources — the bridge lands on a pinned checkout.
- Adding settings pi-blackhole does not already have, or grouping them by hand.
- Duplicating gauge math, validation, or a config path in the plugin.

## Decisions

1. **The bridge lives inside pi-blackhole, not in the web plugin.** Alternative — reimplement the schema in the panel — drifts the moment upstream adds or re-ranges a setting, and cannot reach the `ConfigManager` singleton at all. Cost: the vendored copy must stay pinned and in step with the patch.
2. **Transport is the hosted session's Pi event bus.** Channels: `pi-blackhole-web:settings` with reply channel `pi-blackhole-web:settings-reply` (round trip, 5 s budget), and `pi-blackhole:gauges` as a streamed frame channel the panel subscribes to. Alternative — a separate HTTP endpoint — would make pi-blackhole own a second server and a second config path.
3. **Three bridge additions, all read-only with respect to what pi-blackhole already renders:** `ConfigManager.getFields(values)` returns the schema the terminal modal already draws; `publishGauges()` in the status-bar subsystem emits the bar's already-measured `gauges` and `workers` state and is called after `render()` inside `recompute()`; `src/om/web-bridge.ts` answers get/set frames from the singleton, exposing schema, values, per-scope provenance (`inspect().winners`) and the validated save. Unknown keys are refused with a reason, not silently dropped, so a stale panel cannot invent a config key.
4. **Pin plus patch, rather than tracking upstream.** `scripts/bridge.sh apply` puts the bridge on the currently pinned copy; `bump` fetches upstream HEAD, re-pins, and re-applies. The patch is derived against pi-blackhole `0.5.13` (`1907ede09`). `bump` fails loudly when the patch no longer fits a moved upstream, naming the pinned commit that must be re-derived against.
5. **Control type comes from the field's declared type**, not from a list the plugin keeps: enum → dropdown of the reported options, boolean → toggle, numeric → number input carrying the reported min/max/step, anything else → text input.

## Risks / Trade-offs

- Upstream moves and the patch stops fitting → `scripts/bridge.sh` refuses and names the pinned commit; re-derive the patch before building.
- The bridge is not loaded in the hosted session → the round trip times out and the panel shows a notice naming the bridge and the timeout, rather than hanging or blocking the interface.
- The bridge's new code is not covered by pi-blackhole's tests → `--test-gate` lists `handle` and `registerWebBridge` as untested; keep that gap visible before archive.
- The checked-out dependency set does not match the source (`pi-codemode@1.2.0` contains no `MCP_TYPESCRIPT_PREAMBLE`, which `src/om/tokens.ts` imports) → `tsc --noEmit` and the 45 test files the gate names cannot run until the dependency set is fixed.
- Neither panel has been exercised against a live pi-web host → the observable behavior in the spec's scenarios is unverified end-to-end.
