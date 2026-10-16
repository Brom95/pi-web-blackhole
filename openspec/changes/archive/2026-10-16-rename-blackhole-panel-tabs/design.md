# Design

## Context

See `proposal.md` — Why. The two labels live in one place: the `workspacePanels` contribution returned by the
browser plugin's `activate` (`pi-web-plugin/src/browser/index.js`, today `pi-blackhole settings` at line 468 and
`pi-blackhole status` at line 480). Each entry also carries a stable `id` (`settings`, `status`), an `order`
(`1`, `2`), and its render/onInvalidate handlers, which is where the panel reads settings over the paired request
channel and opens the gauges channel. The host treats `id` as the panel's identity and `title` as the words on the
tab; nothing in the transport reads the title.

## Goals / Non-Goals

**Goals:**
- Change only the words a user reads on the tab, keeping panel identity and behaviour byte-stable.
- Keep the label short enough to survive whatever width the host gives a tab.

**Non-Goals:**
- Renaming panel ids, reordering the panels, or changing which operations they call.
- Changing any in-panel prose. The panels name pi-blackhole in their explanatory lines because those lines refer to
  the component that produced the number, not to the tab; the spec constrains the tab label only.
- Changing `pi-web-plugin/package.json`'s `description`, which is package metadata shown in the plugin catalog, not
  on a tab.

## Decisions

1. **Edit the two `title:` strings in place; leave `id` alone.** The host keys panels by `id`, so a title-only edit
   keeps the panel in the same slot and keeps any per-panel state (the gauge channel, the loaded field list) attached
   to the same panel. Alternative — change the ids too — would move the panel and force the host to re-create it; it
   buys nothing and would break the requirement that renaming cannot move the panel.
2. **Spell the labels `blackhole settings` / `blackhole status`, dropping `pi-` but keeping the component word.**
   Dropping `blackhole` entirely (`Settings` / `Status`) would collide with the host's own generic panel names and
   leave the tab ambiguous once another plugin adds a panel of its own. The user asked for these two words, so the
   shorter form is the requested one.
3. **Accept the revision churn.** Any byte change to `src/browser/index.js` changes the package revision, so the
   session daemon must restart and the browser reload before the labels appear; until then the paired backend refuses
   the new revision. This is the same activation path every earlier panel edit needed, and the spec's
   `Label follows activation` scenario states the observable consequence rather than trying to avoid it.

## Risks / Trade-offs

- [Two tabs read `blackhole …`, so a future second blackhole plugin could collide] → ids stay `settings`/`status`,
  which the host already uses as the collision key; the label is cosmetic.
- [A title edit is easy to apply in the wrong place] → the strings appear twice in the source and also in
  `package.json`'s description and in panel prose; only the two `title:` entries in `activate` may change.
- [The label change is invisible until activation] → the panel already self-explains a stale-revision refusal; the
  migration plan below covers the restart so the label is verified, not assumed.

## Migration Plan

1. Edit the two `title:` strings in `activate`; re-check `node --check` and the harness render, which prints the
   contribution and shows the labels without a browser.
2. Restart the session daemon (the user runs `pi-web restart` themselves), hard-reload the pi-web tab, and read the
   catalog: `active == desired` for the new revision, `stale: false`.
3. Rollback is the reverse: restore the two strings and restart again. No stored state depends on the label, so no
   migration or cleanup is needed in either direction.
