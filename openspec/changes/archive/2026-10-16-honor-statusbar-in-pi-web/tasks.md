# Tasks

## 1. The status panel reads and honours pi-blackhole's switch

- [x] 1.1 In `pi-web-plugin/src/browser/index.js`, name the setting key once as a
  commented constant (owner: pi-blackhole) and read its effective value, with the layer
  it resolved from, through the existing `loadSettings` path so the status panel has the
  value it does not have today. Verify: a harness driver over the current module prints
  the resolved value and winning layer for `statusBar` from a captured settings payload
  (`value: true`, `winner: "global"`), and `node --check` passes.
- [x] 1.2 Gate the gauge rows on that resolved value: render O/P/X only while pi-blackhole
  reports the switch on. Verify: harness render with the payload value `true` draws 3
  gauge rows; with the value flipped to `false` the same harness draws 0 gauge rows and
  no invented numbers.
- [x] 1.3 Render the off-state notice, naming pi-blackhole's own reported `label` for the
  setting rather than plugin prose. Verify: harness render with the value `false` prints
  a notice line containing the reported label (`Footer status bar`) and no gauge rows;
  with `true` prints the gauges and no notice.
- [x] 1.4 Make an absent key mean "on": when the payload reports no such setting, the
  gauges render and no notice appears. Verify: harness render against a payload with the
  `statusBar` field removed draws 3 gauge rows and no notice.
- [x] 1.5 Confirm the tab stays present in both states — no `visible` callback added to
  either `workspacePanels` entry. Verify: ripwire `grep` for `visible` in
  `pi-web-plugin/src/browser/index.js` returns zero hits; the harness still reports 2
  panels with ids `settings` and `status`.
- [x] 1.6 Say in the settings panel where a terminal-only surface goes missing: one meta
  line stating that a row naming a footer or a toast has nothing to draw in this interface
  (the hosted session reports no terminal UI), naming pi-blackhole's own reported `label`
  for the row this panel honours as the exception. Verify: harness render of
  `renderSettingsPanel` prints the meta line containing the reported label
  (`Footer status bar`) and still draws all 33 field rows; with the `statusBar` field
  removed from the payload the line is absent; `node --check` passes.

## 2. Confirm nothing outside the plugin moved, then confirm it live

- [x] 2.1 Confirm the scope held: `vendor/pi-blackhole`, `vendor/pi-blackhole-bridge.patch`
  and `scripts/bridge.sh` are byte-unchanged, and `src/server.js` is untouched. Verify:
  sha256 of each before and after the edit matches; ripwire `grep` for `statusBar` in
  `pi-web-plugin/src/server.js` returns zero hits; `node --check` passes on the browser
  module.
- [x] 2.2 Exercise it end-to-end against the live host at the new revision: the user runs
  the pi-web restart (explicit node path) and hard-reloads; confirm the plugin catalog
  reports `active == desired` and `stale: false`; confirm the settings POST returns 200
  with 33 fields including `statusBar`; confirm the gauges WS returns `ready` then a data
  frame; then save `statusBar: false` through the panel and confirm the status panel
  switches to the off notice naming the setting, and revert the save byte-for-byte. Verify:
  each observable outcome above, recorded in `tasks.md` with the revision.

## Verification

- 1.1–1.5, at the module as it stands after the edit (`node --check` passes, 26333 bytes):
  a harness driver over the current module (the module minus its `export` line, plus a
  dummy `html` tag) renders `renderStatusPanel` in six states —
  `A` reported on: 3 gauge rows, no notice, compaction line present;
  `B` reported off: 0 rows, notice present, no compaction line, 0 worker rows;
  `C` the `statusBar` field absent from the payload: 3 rows, no notice;
  `D` field present but no value reported: 3 rows, no notice;
  `E` field default true with a session-layer override to false: 0 rows, notice names
  the winning layer (`pi-blackhole resolved it from session`);
  `F` off *and* no frame received: notice still rendered, panel 4118 chars, never empty.
  The notice reads verbatim: "The status readout is off: pi-blackhole reports Footer
  status bar as false … Turn statusBar back on in the settings panel …" — the label is
  pi-blackhole's own reported `label`, not plugin prose.
  The same harness prints `statusBarReadout()` against the captured payload as
  `{"on":true,"label":"Footer status bar","winner":"global"}` (task 1.1 verify).
  `plugin.activate` still reports 2 panels, ids `settings` / `status`, `visible=none`
  and `badge=none` on both (task 1.5).
- 1.5, ripwire `grep` for `visible` in `pi-web-plugin`: 0 hits, `complete: true`.
- 2.1, scope held. ripwire `grep` for `statusBar` across `pi-web-plugin` returns 2 hits,
  both in `src/browser/index.js` (the `statusBarReadout` symbol name and its call site);
  `src/server.js` contributes zero. The key string itself appears exactly once, at
  `src/browser/index.js:39` (`const STATUS_BAR_KEY = "statusBar";`).
  `sha256` now: `vendor/pi-blackhole-bridge.patch` `3da705c4…`, `scripts/bridge.sh`
  `8160d910…`, `src/server.js` `cecf7bcc…`. There is no git HEAD in this repo, so a
  before/after hash pair is not available; the substitute is that every file under
  `vendor/pi-blackhole` (22772 files, newest mtime 2026-10-15 21:47), the patch
  (2026-10-15 21:46) and `src/server.js` (2026-10-15 21:00) predate this session's
  edits, whose only write touched `src/browser/index.js` (mtime 2026-10-16 09:58).

- 2.2, end-to-end at revision `sha256:fcc6c8f35d51de459c080b06a030a4b616f288c8a63ac3b3f58b3d98fac62385`:
  the user ran the restart (explicit node path); new PIDs web `3798898`, sessiond
  `3799132` (started 10:16:34/35), and the catalog reports `desired == active ==
  fcc6c8f3…`, `restartRequired: false`, `health: healthy`.
  - settings POST returned **200** directly (no `stale-plugin-revision` 409 race this time):
    33 fields, 31 values, 35 winners, and the `statusBar` field is present as
    `{key: "statusBar", label: "Footer status bar", type: "boolean", value: true}` with
    `values.statusBar: true`, `winners.statusBar: "global"`.
  - gauges WS returned `{"version":1,"kind":"ready"}` then a data frame
    (`obsSince 12459, pool 12143, ctxTokens 83520, observeAfterTokens 15000,
    observationsPoolMaxTokens 20000, compactThreshold 104141, memoryOn true, workers []`).
  - save: POST `action: "set"`, `changes: [{key: "statusBar", value: false}]` → 200, and the
    reply reports `values.statusBar: false`, `winners.statusBar: "global"`.
    **The save is not byte-preserving**: `~/.pi/agent/pi-blackhole/pi-blackhole-config.json`
    went 1082 → 972 bytes and 35 → 31 keys. Besides `statusBar: true → false`, pi-blackhole's
    own `ConfigManager.save` also dropped `cacheRetention: "unset"`, `compactAfterRatio: 0`,
    `compactAfterTokens: 0`, `compactReserveTokens: 0`. That is pi-blackhole's save semantics,
    not the plugin's doing, but it is why the byte-for-byte revert below is the real guard:
    a panel save silently rewrites keys the panel never offered.
  - live browser: the user hard-reloaded and reported the status tab showing the off notice,
    no bars, tab still present (`off_notice`). The harness states above are what pin the
    rendering; this is the human confirmation that the host delivers the payload.
  - revert: the pre-save snapshot was copied back — restored sha `fd007f187d3c67b9aa02961f6d44ed4e74498c6c218002af827dadf090b601c6`,
    1082 bytes, `cmp` reports IDENTICAL to the snapshot; the settings GET after the revert
    reports `values.statusBar: true`, `winners.statusBar: "global"`.

## Workflow follow-up

- Verification for 2.2 depends on a session-daemon restart the user runs; the first
  paired request at a new revision can return HTTP 409 `stale-plugin-revision` before the
  browser reloads — retry rather than treating it as a failure.
- The vitest suite still cannot run in this repo (installed `pi-codemode@1.2.0` lacks
  `MCP_TYPESCRIPT_PREAMBLE`, which `src/om/tokens.ts` imports). That limitation belongs in
  the archived change, so record it in the verification note rather than losing it.
- Archive with `openspec archive honor-statusbar-in-pi-web`; sync the delta into
  `openspec/specs/pi-blackhole-settings/spec.md` first (1 MODIFIED, 2 ADDED requirements).
