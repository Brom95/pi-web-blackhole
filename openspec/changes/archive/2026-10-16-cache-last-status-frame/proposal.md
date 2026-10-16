# Proposal

## Why

The status tab draws only what the gauge channel delivered since the page loaded. The channel
publishes a frame when the hosted session starts, ends a turn, or compacts, so a freshly reloaded
page — or a session whose channel has closed — has nothing to draw and the tab says only that no
frame arrived. The last frame the session published is already in memory and simply gets thrown
away at the next reload, which is the information the user is most likely looking for.

## What Changes

- The last gauge frame the panel receives is **cached**, and the cache survives a page reload, a
  plugin revision change, and a session daemon restart.
- When the panel has no frame for the currently selected conversation, it draws the **cached frame
  for that conversation** instead of an empty state, labelled as cached with its age and the
  conversation it belongs to.
- A cached frame is never presented as live: the panel names which layer the reading came from and
  when it was taken.
- A cached frame belonging to a **different** conversation is never drawn for the selected one.
- The live frame always wins: once a frame arrives for the selected conversation, the panel draws
  it and the cache label disappears.
- **ADDED** cache write path in the server plugin entry (its data directory), and a new round trip
  the browser panel makes to ask for the cached frame. No change to pi-blackhole, its bridge, or
  the published npm package.

## Capabilities

### New Capabilities

- None. The behaviour belongs to the existing `pi-blackhole-settings` capability, which already
  covers what the two tabs show and how they degrade when the bridge is unreachable.

### Modified Capabilities

- `pi-blackhole-settings`: the requirement "Status bar shows the measured gauges" gains a cached
  fallback for the case where no frame arrived; three new requirements govern the cache itself —
  where it is kept, that a cached frame is labelled as cached, and that a frame from another
  conversation is not shown.

## Impact

- `pi-web-plugin/src/browser/index.js` — the status panel's empty state, the gauge channel's frame
  handler, and a new request for the cached frame.
- `pi-web-plugin/src/server.js` — the gauge channel's frame handler writes the cache, and a new
  operation answers a cache read.
- `/home/brom/.pi-web/plugin-data/pi-blackhole-web/` — a new file the server plugin owns. It is
  host runtime state, not repo content, and stays out of git.
- No change to pi-blackhole, to `vendor/pi-blackhole-bridge.patch`, or to the published npm
  package, so no npm release and no new upstream fork is needed.
- Every plugin edit churns the plugin revision, which needs a session daemon restart to load.
