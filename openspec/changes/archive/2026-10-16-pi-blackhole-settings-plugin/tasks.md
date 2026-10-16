# Tasks: pi-blackhole-settings-plugin

## 1. Pin pi-blackhole and bridge it

- [x] 1.1 Pin pi-blackhole as a git submodule at `vendor/pi-blackhole` and verify `git submodule status` reports a pinned upstream commit, not a floating checkout
- [x] 1.2 Derive `vendor/pi-blackhole-bridge.patch` against that pinned commit and verify `git apply --check --reverse` confirms the pinned copy plus the patch equals the working tree
- [x] 1.3 Expose the settings schema from the pinned copy (`ConfigManager.getFields`) and verify `tsc --noEmit` over the patched copy is clean
- [x] 1.4 Publish the status bar's already-measured gauges and workers on `pi-blackhole:gauges` from the pinned copy and verify `recompute()` calls the publisher after `render()` without duplicating gauge math
- [x] 1.5 Answer `pi-blackhole-web:settings` frames from the pinned copy (schema, values, per-scope provenance, validated save) and verify a change for an unknown key is refused with a reason rather than written or dropped

## 2. Web plugin transport to the pinned copy

- [x] 2.1 Relay settings get/set round trips to the pinned copy over the hosted session event bus and verify a non-answering bridge replies with a timeout notice naming the bridge rather than hanging
- [x] 2.2 Open the gauges channel and verify every frame the pinned copy publishes reaches the browser panel, and the connection closes on abort

## 3. Browser panels

- [x] 3.1 Render the settings panel from the schema the pinned copy reports — enum dropdown, boolean toggle, number input carrying the reported min/max/step — and verify no setting key, option list, range, or config path appears in the plugin source
- [x] 3.2 Apply selected changes through the pinned copy's validated save and verify pi-blackhole's refusal reason is shown verbatim and the panel re-reads the saved values
- [x] 3.3 Show which scope owns each value from the provenance the pinned copy reports and verify the panel does not derive scope itself
- [x] 3.4 Render the O/P/X gauges from the published gauge state with a label stating what each counts and what fills it, and verify no token math is recomputed in the plugin
- [x] 3.5 Render worker state and stage deltas exactly as published, and verify the panel states "no live gauges" when no gauge frame has arrived
- [x] 3.6 Verify opening or refreshing either panel sends no message to the model

## 4. Integration checks

- [x] 4.1 Verify the vendored copy and the bridge are in step (`git apply --check --reverse` on the patch succeeds) and that the four bridge files in the working tree match the patch
- [x] 4.2 Run ripwire `quality_delta` over the working tree and confirm no new gating failure
- [x] 4.3 Run ripwire `--test-gate` and report changed/impacted/tests/untested counts for the bridge
- [x] 4.4 Exercise both panels end-to-end against a live pi-web host and verify the gauges, the save, and the refusal notice actually appear

## Workflow follow-up

- `1.3` verified outside the repo: `tsc --noEmit` exits 0 with no diagnostics over a byte-identical copy of the patched
  sources, resolved against the published `@earendil-works/*` set (`1.2.0`) plus `@types/node` and `vitest`. The
  pinned copy itself still has no installed dependencies, so this is a proxy run rather than the vendored tree's own
  toolchain.
- `4.4` verified at the live revision `sha256:be5135c2…` (`active == desired`, `stale: false`): settings round trip returned 33
  fields each carrying pi-blackhole's own `description`; an unknown key returned `{error: "unknown setting: …"}` with the
  global config file byte-unchanged; a validated save wrote only the changed field to
  `/home/brom/.pi/agent/pi-blackhole/pi-blackhole-config.json` and reverting restored it byte-for-byte; the gauges
  channel returned `ready` then a data frame (`obsSince 10966/15000`, `pool 6799/20000`, `ctxTokens 79201/104141`,
  `memoryOn: true`). Rendering that live frame drew 33 styled control rows (8 selects with carets, 11 checkboxes,
  14 number inputs), 3 gauge bars each with a `left before <threshold> is reached` line, and a `Last compaction`
  line derived from pi-blackhole's own `ctxTokens`/`compactThreshold`.
- The vitest suite cannot run until the checked-out dependency set matches the source; keep that limitation visible before archiving.
