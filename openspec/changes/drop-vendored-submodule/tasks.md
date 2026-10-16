# Tasks: drop-vendored-submodule

## 1. Take the pinned copy out of the repo

- [x] 1.1 Remove the submodule entry from the index without deleting the local tree
      (`git rm --cached vendor/pi-blackhole`), and confirm `git ls-files vendor/` now lists only
      `vendor/pi-blackhole-bridge.patch`
- [x] 1.2 Remove `.gitmodules` from the index and disk, and confirm `git ls-files` no longer lists it and
      `git ls-files vendor/pi-blackhole` is empty
- [x] 1.3 Add `vendor/pi-blackhole/` to `.gitignore` and confirm `git status --short` is clean while the
      patched copy is still on disk (`git -C vendor/pi-blackhole rev-parse HEAD` still resolves)

## 2. Keep the bridge tooling honest

- [x] 2.1 Drop the `git add vendor/pi-blackhole` line from `bump()` in `scripts/bridge.sh`, keep its
      fetch / checkout / `apply` steps, and reword its help text from re-pinning to refreshing upstream
- [x] 2.2 Add a provenance header to `vendor/pi-blackhole-bridge.patch` naming the upstream version and commit
      the bridge was derived against, and confirm `git apply --check` still accepts the file with the header
- [x] 2.3 Confirm `bash -n scripts/bridge.sh` parses and `apply` still refuses, naming the commit, when the
      patch no longer fits the copy it is handed

## 3. Rewrite the README around the new layout

- [x] 3.1 Layout section: drop the submodule line, name the patch and say the upstream copy is fetched, not shipped
- [x] 3.2 Install section: keep the required steps unchanged; replace the optional pinned-copy section with
      "Hacking on the bridge", which starts by cloning `https://github.com/k0valik/pi-blackhole`
- [x] 3.3 License section: keep the upstream link and MIT attribution, and name the version and commit the
      published bridge was written against

## 4. Publish and confirm nothing else moved

- [x] 4.1 Commit and push to `main`, and confirm the pushed tree has no submodule entry and no
      `.gitmodules`
- [x] 4.2 Confirm this change moved no plugin file (catalog `desired` unchanged, no new churn) and that both
      panels still answer at the revision that is actually loaded, so no daemon restart was caused by it

## Verification

Recorded so far:

- After 1.1–1.3: `git ls-files` lists `vendor/pi-blackhole-bridge.patch` and no `vendor/pi-blackhole`, no
  `.gitmodules`; `git status --short` shows only the staged deletions plus the edited `.gitignore`; the local
  copy is still a repo at `1907ede` and is ignored.
- 2.2: `git -C vendor/pi-blackhole apply --check --reverse <patch>` passes with the three-line header present,
  which proves the header is ignored and the diff content is byte-intact. The forward check fails, as expected,
  because the bridge is already applied to that tree.
- 2.3: `bash -n scripts/bridge.sh` parses; `./scripts/bridge.sh apply` refuses with
  `The bridge patch no longer fits the local pi-blackhole copy (1907ede).` and exits 1; `./scripts/bridge.sh nope`
  prints the usage line and exits 1.
- `scripts/bridge.sh` grew 988 → 960 bytes across the two ripwire `replace_symbol_body` calls (`apply` 391 →
  393, `bump` 114 → 84); `edit_check` reported `status=unchanged`, `incompatible=0` for both.
- 4.1: `git ls-tree -r origin/main` lists `vendor/pi-blackhole-bridge.patch` and no `vendor/pi-blackhole`;
  counting mode `160000` entries across the whole pushed tree returns **0**, and `.gitmodules` is absent from
  both the pushed tree and disk. The push was a fast-forward on `main` (no force).
- 4.2: this change touched no file under `pi-web-plugin/`, so the plugin revision did not move because of it.
  The newest file mtimes in the package are `src/browser/index.js` (26924 bytes) and `src/server.js` (3917 bytes),
  both from the previous change. The catalog still reports `desired == e62bf77f…` against `active == fcc6c8f3…`
  with `restartRequired: true` — that churn is the previous change's meta-line edit, which the user has not
  restarted for, and this change added none on top of it.
- 4.2 live read at the revision that is actually loaded (`fcc6c8f3…`): the settings round trip returned **200**
  with 33 fields / 31 values / 35 winners, `statusBar` present as `{label: "Footer status bar", value: true}`
  with winner `global`, and scopes `{global, project, session}`. The gauges channel returned `{kind: "ready"}`
  and no data frame inside 25 s — the emitter publishes on turn boundaries and this turn was still open, so
  the absence is the expected shape, not a dead channel.
