# Proposal

## Why

The workspace tabs currently read `pi-blackhole settings` and `pi-blackhole status`, which repeats the package
prefix the user never says out loud and pushes the two-word label past the tab's visible width. The tabs should
name what they show — settings and status — with the component identified once, as `blackhole`.

## What Changes

- The settings workspace panel tab title changes from `pi-blackhole settings` to `blackhole settings`.
- The status workspace panel tab title changes from `pi-blackhole status` to `blackhole status`.
- Panel ids (`settings`, `status`), order (`1`, `2`), renderers, and the operations they call
  (`settings`, `gauges`) stay exactly as they are, so the rename is presentation-only.
- No change to pi-blackhole itself, to the bridge, or to what either panel reads and writes.

## Capabilities

### New Capabilities

(none — the behaviour belongs to the capability this plugin already owns)

### Modified Capabilities

- `pi-blackhole-settings`: the panels gain a labelling requirement — each workspace tab is labelled by what it
  shows (`blackhole settings`, `blackhole status`), and the label is decoupled from the panel's stable id, so
  renaming a tab cannot move or re-create the panel.

## Impact

- `pi-web-plugin/src/browser/index.js` — the two `title:` strings in the `activate` contribution
  (today: line 468 `pi-blackhole settings`, line 480 `pi-blackhole status`). Nothing else in that file changes.
- Revision churn: any edit to `pi-web-plugin/src/browser/index.js` changes the package revision, so the session
  daemon must restart and the browser reload before the new labels appear; a paired request against a stale
  active revision is refused. This is the same activation path every earlier panel edit needed.
- `pi-web-plugin/package.json`'s `description` still says `pi-blackhole settings and O/P/X gauges…`; that string is
  package metadata, not a tab label, and is out of scope for this change.
- No effect on the settings surface, the save path, the gauges channel, or pi-blackhole's pinned copy.
