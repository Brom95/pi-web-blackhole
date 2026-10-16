# Tasks

## 1. The server entry keeps the last frame it is handed

- [x] 1.1 Write a record in `handleGauges` where it already receives each frame: the frame, the
  conversation it belongs to, and the moment it was taken. Keep the forwarding to the browser
  unchanged.
- [x] 1.2 Read that record back over a new operation on the existing `request` path, returning
  nothing when there is no record. A corrupt or unreadable record reads as no record and must not
  fail the request.
- [x] 1.3 Bound the records to the newest conversations so switching sessions all day does not grow
  the data directory without limit.
- [x] 1.4 Confirm no record is written or replaced from a failed or cancelled open, or from a channel
  that closed without publishing.

## 2. The status panel draws the cached frame and says it is cached

- [x] 2.1 Ask the server for the record only when the panel has no frame for the selected
  conversation — including when the gauge channel closed or failed — and not while a healthy channel
  is open.
- [x] 2.2 Draw the cached frame's gauges through the same rows the live frame draws, so no number is
  recomputed in the plugin.
- [x] 2.3 Label the reading as cached: a separate line naming its age and the conversation it belongs
  to, plus a caption above the bars, in a style distinct from both the live reading and the
  status-off notice.
- [x] 2.4 Never draw a record that belongs to another conversation: when the selected conversation
  has no record, keep today's "no live gauges" state.
- [x] 2.5 Once a frame arrives for the selected conversation, draw it as live and drop the cached
  label.
- [x] 2.6 Keep the cache read wrapped like the settings read already is, so a failed read leaves the
  panel exactly as it is today.

## 3. Confirm nothing outside the plugin moved, then confirm it live

- [x] 3.1 Confirm `vendor/pi-blackhole-bridge.patch` and the installed pi-blackhole are byte-identical
  to their state before this change, and that no npm release is implied.
- [x] 3.2 Confirm the record file lives in the host data directory and that nothing new is tracked in
  git.
- [x] 3.3 Restart the session daemon at the new plugin revision, then read the settings round trip and
  the gauge channel at that revision to confirm the bridge still answers.
- [x] 3.4 Reload the page with a session that published a frame and confirm the tab draws the cached
  frame with its label, not the empty state.
- [x] 3.5 Select a conversation that has no record and confirm no numbers from another conversation
  appear.
- [x] 3.6 Confirm a live frame replaces the cached reading and the label disappears.

## Verification

Checked in isolation against the real module bodies (the entries copied to `/tmp`, their
`import`/`export` lines stripped, a driver appended). Nothing here ran against the live host.

- Server entry (`/tmp/srv-run.mjs`, 17 checks, all PASS): `recordName` refuses `../../etc/passwd`,
  `""`, `short`, `has space.json` and a 70-char id, and accepts `ok-SESSION_1` as
  `ok-SESSION_1.json`; a good record writes one file and reads back with its own `sessionId` and
  frame; `handleCache` with no `input.sessionId` returns `{}`; corrupt JSON, `version: 2`, a record
  naming another conversation, a record with no `frame`, and a path that cannot be read all read as
  no record and never throw; 30 conversations leave exactly 24 `.json` records and the newest one
  survives pruning; `writeRecord("")` writes nothing.
- Browser entry (`/tmp/cache-run.mjs`, 11 cases, all PASS): a live frame draws 3 bars with no cached
  caption and no cached meta line; no live frame plus a record draws 3 bars, the caption and the
  `Cached reading` meta line; nothing at all keeps today's empty state; `statusBar` false with a
  record keeps the off notice and draws no bars and no cached caption; a cached frame whose own
  `memoryOn` is false draws only the X bar; a record naming another conversation is ignored and the
  empty state stays; a matching record is drawn; a throwing cache read leaves the empty state; a
  live frame asks for nothing (0 requests); the same conversation is asked once across three renders
  (1 request); no selected session asks nothing.
- Wording: `humanAge` now reads `45s`, `1h 2min`, `1h`, `1d 1h` — a frame older than a day says days,
  not `25h`.
- Task 2.1 deviation, recorded honestly: the guard is on the **frame**, not on the channel. A healthy
  channel that has not yet published a frame does ask for the record, because the spec scenario
  "Cached frame drawn instead" requires the cached reading on a page load whose channel is open but
  silent. What is refused is asking while this page already has a frame, while a read is in flight,
  and a second time for a conversation already checked.
- Scope held (task 3.1): `vendor/pi-blackhole-bridge.patch` on disk is byte-identical to its git
  HEAD blob (`sha256:76a67cdf…` both sides); the installed pi-blackhole is still `0.5.13` with
  `dist/index.js` at `sha256:715e6957…`, untouched by this change; `git diff --stat HEAD` lists
  exactly two files — `pi-web-plugin/src/browser/index.js` and `pi-web-plugin/src/server.js`. No
  pi-blackhole source, no patch and no npm release moved.
- Nothing new is tracked in git (task 3.2, half): `git status --short` shows only those two modified
  plugin files plus the untracked `openspec/changes/cache-last-status-frame/`. The record path is
  under `/home/brom/.pi-web/plugin-data/pi-blackhole-web/gauge-cache/`, which is outside the repo —
  `git check-ignore` refuses the path because it is not in the repository at all.
- Live host at `sha256:dd967ff9…` (`desired == active`, `stale: false`, `restartRequired: false`,
  `health: healthy`) — task 3.3:
  - `POST …/settings` → HTTP 200, 33 fields, 31 values, `statusBar` reported `true` with winner
    `global`.
  - `POST …/cached` → HTTP 200 with `{sessionId, at, frame}` for the selected conversation only
    (`age 761s`, `obsSince 10534`).
  - `GET`-style gauge channel over `ws://…/channels/gauges` opened at the same revision: `ready`
    then two `data` frames (`obsSince 3438`, `pool 9528`, `ctxTokens 90240`,
    `compactThreshold 104141`, `memoryOn: true`, `workers: []`). The bridge still answers.
  - The record file was rewritten at 13:58:57 with the newest frame (`obsSince 3438`), while the
    `cached` read moments earlier returned the older one (`obsSince 10534`) — so records keep
    updating per frame, and the directory holds exactly one `.json` file (the atomic
    write-then-rename leaves no `.writing` residue).

## Workflow follow-up

- The first paired-plugin request at a new revision can answer 409 `stale-plugin-revision` until the
  browser reloads; retry after the reload rather than treating it as a failure.
- The gauge emitter publishes on turn boundaries, so a gauge channel that answers `ready` with no
  data frame during an open turn is the expected shape, not a dead channel.
- There is no vitest harness for the browser entry; verify the panel by reading the served module and
  by reading the live tab, and record what was and was not checked.
