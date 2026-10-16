# Design

## Context

Current state, verified against the shipped code:

- Hosted pi-web sessions are handed `hasUI: false`
  (`pi-web/dist/server/sessions/piSessionService.js:381`, the only occurrence in the
  whole dist). The terminal footer `statusBar` controls is therefore never drawn in
  pi-web, in either state.
- pi-blackhole's own gate sits inside `render()` (`src/om/status-bar.ts`), while
  `recompute()` runs unconditionally and publishes the gauge state the pi-web channel
  carries. So the pi-web readout is independent of `statusBar` today — turning the
  footer off never dimmed it, and this change is what makes it dim.
- The settings payload the plugin already receives carries the field:
  `{ key: "statusBar", label: "Footer status bar", type: "boolean", value: true,
     description: "Show token gauges (O/P/X) and worker events in the footer" }`,
  with a resolved value and the winning layer. The plugin currently names `statusBar`
  nowhere (zero hits in `pi-web-plugin`).
- The published gauges frame carries `obsSince, pool, ctxTokens, observeAfterTokens,
  observationsPoolMaxTokens, compactThreshold, memoryOn, workers` — **no** `statusBar`.
- `WorkspacePanelContribution` offers `visible?: (context) => boolean`
  (`plugin-api.d.ts:563`); the host evaluates it synchronously (`e.visible?.(t) ?? !0`).
- Scope constraint from the user: every edit lands in the plugin. pi-blackhole's source,
  the vendored bridge patch, and the published npm runtime stay untouched — no bridge
  extension, no `scripts/bridge.sh bump`, no npm release.

## Goals / Non-Goals

**Goals:**
- `statusBar` means the same thing in pi-web as it does in the terminal: the status
  readout is on or off.
- The plugin reads pi-blackhole's answer; it never becomes the owner of the setting.
- The off state is legible to a user who has never read this spec.

**Non-Goals:**
- Making the terminal footer appear in pi-web. `hasUI: false` is the host's decision and
  the plugin cannot change it.
- Giving the other host-inapplicable settings (`showWorkerNotifications`,
  `showPreCompactionMessage`) the same treatment. See Open Questions.
- Any change to how pi-blackhole publishes gauges, or to the bridge transport.

## Decisions

**D1 — gate the panel's content, not the tab.**
`visible` is the only tab-level lever the API offers, and the host calls it
synchronously against a panel context. The `statusBar` value arrives asynchronously
over a peer round trip, so a `visible` closure would have to consult a cache that may
not exist yet — the tab would flicker or be wrong on first paint.
*Alternative considered:* hide the tab when off. Rejected for that ordering hazard, and
because a hidden tab is worse for discovery than an explained one: the user cannot find
the setting that brought the panel back.

**D2 — the settings payload is the source of truth, not the gauges frame.**
The frame does not carry the switch (verified above). Reading it from the settings
round trip is the only plugin-only route.
*Alternatives rejected:* extend `publishGauges` to carry it (needs an npm release —
outside the stated scope); infer "off" from missing gauges (conflates "off" with
"no live session", which the existing spec already distinguishes).

**D3 — the status panel issues its own settings read, through the existing path.**
`loadSettings` (`src/browser/index.js:52`) already exists and is used by the settings
panel's `render`/`onInvalidate`; the status panel does not call it today. Reuse that
path rather than inventing a second transport. Cache the resolved value; on failure,
fall back to the last known value and let the existing "unreachable bridge degrades
visibly" requirement cover the notice.

**D4 — one named constant for the key, with an absent-key fallback of "on".**
Plugin-only scope forces the key name to appear in the plugin exactly once. This is a
new fact about pi-blackhole living in the plugin, and it is the honest cost of the
scope the user asked for. It does not violate "wrapper, not reimplementation": the
plugin still does not restate the field's schema, type, default, validation, or save —
it reads one reported value. If pi-blackhole stops reporting the key, the gate
disappears and the panel behaves as it does today; that is the safe direction, since a
renamed key must not silently hide a live readout.

**D5 — name the setting using pi-blackhole's own label, not plugin prose.**
The payload carries `label: "Footer status bar"`. The off-state notice should interpolate
that reported label rather than hardcode wording, so the sentence follows pi-blackhole if
upstream renames the label. The word "footer" is then upstream's, not the plugin's —
which also keeps the earlier invariant that panel copy is not a second identity for the
feature.

## Risks / Trade-offs

- [Existing users lose their gauges once the gate lands] → the off state names the
  setting and says the readout is off, so the loss is stated rather than silent.
- [One extra settings round trip per status render] → reuse the panel's existing
  invalidate/cache cycle; the round trip already has a 5 s budget and the panel already
  re-renders on invalidation. Measure, don't assume, once live.
- [`statusBar` renamed upstream] → the absent-key fallback is "on", so the worst case is
  today's behavior, not a dark panel.
- [The gate is a plugin-side fact about pi-blackhole] → confined to one constant,
  commented with pi-blackhole as the owner, so a future upstream-side fix has exactly one
  place to remove.
- [Verification gap] → the vitest suite still cannot run (dependency mismatch predates
  this change). Verification is harness render plus end-to-end against the live host.

## Migration Plan

No data or config migration: the setting already exists and is already saved by
pi-blackhole. Deploying is the established revision churn — edit the browser module,
restart the session daemon, reload the browser, confirm `active == desired` in the plugin
catalog. Rollback is the same churn in reverse; nothing persisted changes.

## Open Questions

- Whether `showWorkerNotifications` and `showPreCompactionMessage` get the same
  treatment. Both are host-inapplicable by the same mechanism, but neither is decided
  here; they would be a separate change and do not alter these requirements, this
  approach, or the task breakdown.
- Whether the off-state notice should also appear in the settings panel next to the row.
  Cosmetic; answerable once the panel is live.
