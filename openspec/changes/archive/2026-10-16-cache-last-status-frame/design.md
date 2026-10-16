# Design

## Context

The status panel already keeps the last frame it received: `gauges` and `gaugeFrameAt` are module
level in `pi-web-plugin/src/browser/index.js`, and the panel prints "Last frame — Ns ago". That
state lives in the browser entry, so it is lost when the page reloads or the plugin revision changes,
and it is empty on a machine whose session has published but whose page has not yet received a
frame. The server entry sees every frame — `handleGauges` subscribes to the session's gauge channel
and forwards each one to the browser — so the durable half of the cache belongs there.

The host gives the server entry a writable `dataDirectory` in its activation context, and the host
already created `/home/brom/.pi-web/plugin-data/pi-blackhole-web/` for this plugin; it is empty
today. That directory is host runtime state outside the repo, so a file there is never repo content
and never needs a gitignore entry.

The panel's empty state is one branch today: `gauges ? … : "no frame received yet"`, plus the
`gaugeStatus` line that already distinguishes "no conversation selected", "no paired channel",
"connecting…", "connected — frames arrive as the session runs", "the session closed the gauge
channel", and "gauge channel failed: …".

## Goals / Non-Goals

**Goals:**
- The last frame a conversation published stays available after a reload and after a daemon restart.
- The panel draws it when nothing arrived for the selected conversation, labelled so it cannot read
  as live.
- Nothing outside the plugin moves: no pi-blackhole edit, no patch change, no npm release.

**Non-Goals:**
- No new gauge values, no recomputed token math, no gauge the plugin invents.
- No cache for the settings panel — settings are read fresh on every render and have no stale state
  worth keeping.
- No age limit on the cache: the label, not a cutoff, is what keeps an old frame honest.
- No change to how pi-blackhole publishes frames, and no new session event bus channel.

## Decisions

- **D1 — two layers, as the user chose.** Page memory (`gauges`, already there) is the fast path; a
  file in the server entry's `dataDirectory` is the durable one. The browser asks the server for the
  record only when it has nothing of its own, so the common case costs no extra round trip.
  Alternative considered: browser `localStorage` alone — cheaper, but it does not survive a daemon
  restart and it is per browser, so it fails the "survives a restart" goal on its own.
- **D2 — the server entry writes the record where it already handles frames.** `handleGauges` already
  receives every frame from the session; it writes `{at, frame, sessionId}` beside its existing
  subscription, no new channel and no new frame path. The browser's `onData` keeps doing what it
  does now.
- **D3 — one record per conversation, keyed by session id.** The user chose to hide a frame that
  belongs to another conversation, so the key has to be the conversation, not the plugin. Session
  ids are UUIDs, so one file per session id in the data directory is the simplest layout; a single
  JSON map would need a lock-free rewrite of everything on every frame. Bound the directory to the
  newest records (the same retention idea pi-web itself uses for notices) so switching conversations
  all day does not grow it without limit.
- **D4 — only a published frame writes a record.** The write sits in the frame callback, not in the
  open. A failed open, a cancelled open, and a channel that closed without publishing must not
  create or overwrite a record, or a bad attempt would erase the last good reading.
- **D5 — the cached label is a separate line, not a re-skinned live line.** The panel keeps "Last
  frame" for what it received on this page and adds "Cached reading — 4 min ago, session
  <label>" when it drew from the file, plus a caption above the bars. A distinct style (muted colour,
  dashed border) rather than the warning colour: a cached reading is not a fault, and the warning
  colour is already used by the status-off notice.
- **D6 — the cache read is conditional on the panel having nothing.** The panel asks for the record
  when it has no frame for the selected conversation, including the case where the channel closed or
  failed. It does not ask while a healthy channel is open, so a live session pays no extra cost.
- **D7 — a cache read that fails degrades to today's empty state.** The new operation is wrapped
  like `loadSettings` already is; a failure leaves the panel exactly as it is now, with the
  `gaugeStatus` line naming what happened.

## Risks / Trade-offs

- An old frame still draws. No age cutoff was chosen, so a conversation last active yesterday shows
  yesterday's numbers with a label that says so. The label is the whole defence; a cutoff would have
  traded a hidden reading for a hidden reading.
- The record is per machine and per plugin, not per browser. Two pi-web instances sharing a data
  directory share records; the conversation key keeps them from crossing sessions, but not from being
  read by a different browser on the same machine, which is what the user asked for.
- The cache is only as fresh as the last published frame. pi-blackhole publishes on turn boundaries,
  so a session mid-turn has no newer frame to cache — the cached reading is not behind the live one,
  it is the same one.
- A file in the host data directory is written by the session daemon, which has full filesystem
  permissions. One small JSON per conversation in the plugin's own directory, and the plugin must
  treat a corrupt or unreadable record as "no record", never as a crash.
- Every plugin edit churns the plugin revision and needs a daemon restart to load, which interrupts
  live sessions.
