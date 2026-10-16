# pi-web-blackhole

pi-blackhole's settings and its O/P/X token gauges as two tabs inside the
[pi-web](https://pi-web.dev) browser, so both can be changed and watched without
sending a message to the model.

> **Everything in this repository was written by an AI assistant.** The plugin
> code, the bridge, the docs, the planning trail under `openspec/`, and the commit
> text are all AI-generated, not hand-written. Review the source before you
> install it: pi-web plugins run in your browser page and inside the session
> daemon with its filesystem and process permissions, and they are not sandboxed.

This is a **derivative** of the original terminal plugin
[pi-blackhole](https://github.com/k0valik/pi-blackhole) by
[k0valik](https://github.com/k0valik) (MIT, npm package `pi-blackhole`). The
original plugin owns the settings schema, validation, scopes, saving, and all the
token measurement; this repository adds only a browser surface for it.

## What you get

Two workspace tabs in pi-web, over the selected session:

| Tab | Shows |
| --- | --- |
| **blackhole settings** | every pi-blackhole setting as a styled control — select, checkbox, number — with pi-blackhole's own label, description, current value, and the layer that won (global / project / session) |
| **blackhole status** | the O/P/X gauges as live bars, what each bar measures and why it is at its current value, worker-stage rows, and compaction distance |

The panel never restates a field, a range, or a config path. It asks pi-blackhole
over the hosted session's event bus and renders what pi-blackhole answers, so the
web surface cannot drift from the terminal settings surface.

One setting needs a caveat: **Footer status bar** names a terminal surface. pi-web
hands hosted sessions `hasUI: false`, so pi-blackhole's footer never draws in the
browser at all. Here the switch gates the **status panel** readout instead — same
meaning pi-blackhole already uses ("the status readout is off"), different surface.
The gauge channel itself stays live either way.

## Install

You need pi-web installed and running, and Pi's package manager.

```sh
# 1. the upstream plugin — its published 0.5.13 already answers the web channels
pi install npm:pi-blackhole

# 2. this repository
git clone https://github.com/Brom95/pi-web-blackhole.git
cd pi-web-blackhole
pi install ./pi-web-plugin
```

`pi install` writes the package declaration into `~/.pi/agent/settings.json`;
`pi list` shows what is installed and `pi remove <source>` removes it.

Then load the server entry:

```sh
pi-web restart          # restarts the web server and the session daemon
```

and hard-reload the browser page. Restarting interrupts active sessions and
terminals, so do it when nothing is mid-work.

### Check it loaded

Open **Settings → PI WEB plugins** on the affected machine: `pi-blackhole-web`
should read installed, enabled, compatible, active. A `stale` or
`restart-required` state means the daemon has not picked the new revision up —
restart the daemon, then reload the browser. The first request after a restart can
return a `stale-plugin-revision` refusal until the page has reloaded; retry once.

### Optional: the pinned source copy

Only needed if you are working on pi-blackhole's source, not if you are using the
plugin:

```sh
git submodule update --init vendor/pi-blackhole
./scripts/bridge.sh apply   # bridge onto the currently pinned pi-blackhole
./scripts/bridge.sh bump    # fetch upstream HEAD, re-pin, re-apply
```

`bump` fails loudly when the patch no longer fits a moved upstream. The patch is
derived against pi-blackhole `0.5.13`, commit `1907ede09`.

## Layout

```
pi-web-plugin/          browser API v4 / server API v3
  src/browser/index.js  the two workspace panels
  src/server.js         relays to pi-blackhole over the hosted session event bus
vendor/pi-blackhole     the upstream plugin, pinned as a git submodule
vendor/pi-blackhole-bridge.patch   the bridge applied onto that pinned copy
scripts/bridge.sh       apply / bump: keeps the pinned copy and the bridge in step
openspec/               the change proposals, designs, and the spec
.pi/                    the OpenSpec skills and prompts used while building this
```

## Why the bridge lives in pi-blackhole

Installed pi-blackhole ships as one bundled `dist/index.js`: there is no importable
`ConfigManager` singleton and no subpath to the settings modules. The bridge
therefore has to be part of pi-blackhole itself, where the schema, the merged
values and the measured gauges already live. Three additions, all read-only with
respect to what pi-blackhole already renders:

- `ConfigManager.getFields(values)` — the schema the terminal modal already draws.
- `publishGauges()` in the status-bar subsystem — emits the bar's already-measured
  `gauges` and `workers` state on `pi-blackhole:gauges`; `recompute()` calls it
  after `render()`. No gauge math is duplicated.
- `src/om/web-bridge.ts` — answers `pi-blackhole-web:settings` frames from the
  ConfigManager singleton: schema, loaded values, per-scope provenance, and `save`
  for writes. Unknown keys are refused.

## License

This repository is Apache-2.0 — see [`LICENSE`](LICENSE). The upstream
[pi-blackhole](https://github.com/k0valik/pi-blackhole) it builds on is MIT-licensed
(k0valik) and stays a submodule pointer, not a copy; `vendor/pi-blackhole-bridge.patch`
is a modification of that MIT-licensed source and is attributed to it.

## The planning trail

`openspec/` carries the change proposals, designs, task lists, and archived specs
this repository was built through — including the honest "not verified" notes each
change left behind. Read it if you want to know why the code looks the way it does.

## Verified

- `tsc --noEmit` over the whole patched pi-blackhole source: clean.
- ripwire `quality_delta`: `gating=0`; the `minor` findings are the bridge's own
  additions. ripwire `--test-gate`: `changed=4 impacted=125 tests=45 untested=5`.
- End-to-end against a live pi-web host: the settings round trip returned 33 fields
  with provenance, the gauges channel returned a live frame, a saved write was
  reflected in the reply, and the status panel drew the gauges and the off-state
  notice.

## Not verified

- The upstream vitest suite has never run here. The checked-out dependency set does
  not match the repo's source: installed `pi-codemode@1.2.0` contains no
  `MCP_TYPESCRIPT_PREAMBLE`, which pi-blackhole's own `src/om/tokens.ts` imports.
  Fix the dependency set, then run the 45 test files the gate names.
- Saving through the panel rewrites pi-blackhole's config file and drops keys that
  live outside the panel surface (35 keys → 31 in one observed save). That is
  pi-blackhole's own save behaviour, not this plugin's, but it means a panel save is
  not byte-preserving.
