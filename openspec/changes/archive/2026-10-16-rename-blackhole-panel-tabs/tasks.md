# Tasks

## 1. Rename the tab labels

- [x] 1.1 In `pi-web-plugin/src/browser/index.js`, change the two `title:` strings of the `workspacePanels` entries
  returned by `activate` to `blackhole settings` and `blackhole status`, leaving `id`, `order`, `render`, and
  `onInvalidate` untouched — verify: ripwire `grep` for `pi-blackhole settings` and `pi-blackhole status` returns no
  hit inside `activate`, and `node --check` on the file exits 0.
- [x] 1.2 Confirm nothing else moved: render the contribution through the node harness used for the panels and read
  the printed tabs — verify: the harness prints `blackhole settings` and `blackhole status` with ids still
  `settings` and `status` and orders `1` and `2`.
- [x] 1.3 Give both `workspacePanels` entries an `icon` (`context.svg` template) — the host tab strip prints a
  fallback mark derived from the title's initials, and when two panels collide it substitutes the **full title**, so
  one tab button rendered the label twice; an icon bypasses that path — verify: the harness prints both panels with
  `icon=TemplateResult`, ids still `settings`/`status`, orders `1`/`2`.

## 2. Activate the new revision and read the tabs

- [x] 2.1 Ask the user to run `pi-web restart` themselves, then hard-reload the pi-web tab — verify: `pi-web status`
  reports new PIDs and `GET /api/plugins` shows `active == desired` for the new composite revision with
  `stale: false` and `restartRequired: false`.
- [x] 2.2 Read both tabs on the reloaded page and confirm the panels still work — verify: the user reports the two
  tabs reading `blackhole settings` and `blackhole status`, one label each, and accepted the icons; at the same revision
  the paired settings request
  (`POST /api/paired-plugin-backends/pi-blackhole-web/projects/<project>/workspaces/<workspace>/settings`) still
  returns the 33 fields and the gauges channel still returns `ready` then a data frame.

## Workflow follow-up

- The vitest suite still cannot run: installed `pi-codemode@1.2.0` has no `MCP_TYPESCRIPT_PREAMBLE`, which
  pi-blackhole's `src/om/tokens.ts` imports. Keep that limitation visible before archiving.
- ripwire `quality_delta` cannot run here (the repo has no git HEAD), and `edit_check` reports `no-baseline`.
- The doubled tab labels the user reported after the rename were host-side, not a second registration: the plugin
  contributes each title exactly once (served module byte-identical to disk, one manifest entry, one machine, one
  package registration). The host's `app-mobile-main-tabs` strip calls `renderTabMark`, which for a panel with no
  `icon` shows `initialsLabel(title)`; `fullFallbackLabel` replaces that mark with the whole title whenever two tabs
  share initials — `blackhole settings` and `blackhole status` both reduce to `BS`, so the tab printed the title twice.
  Fixed by declaring an `icon` on each panel (task 1.3), not by changing the host.
- Verified at composite revision `sha256:74258e3d…` after the user restarted the session daemon (new PIDs: web
  3695933, sessiond 3696174; catalog `active == desired`, `stale: false`, `restartRequired: false`, health
  `healthy`). The first settings `POST` raced the daemon's plugin activation and returned
  `stale-plugin-revision` (HTTP 409); the retry returned 200 with 33 fields, 35 winners, and
  `scopes {global,project,session}`. The gauges channel returned `ready` then a data frame
  (`obsSince 120`, `pool 10975`, `ctxTokens 83006`, `compactThreshold 104141`, `memoryOn true`,
  and a live `workers [{type: dropper, kind: done, delta: 3}]` row).
- Archive with `/opsx-archive` once the checks pass; the delta merges into
  `openspec/specs/pi-blackhole-settings/spec.md` (two ADDED requirements, no removals).
