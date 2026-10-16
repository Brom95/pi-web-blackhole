# Design: drop-vendored-submodule

## Context

`scripts/bridge.sh` is two functions over two paths:

```
SUB=vendor/pi-blackhole
PATCH=vendor/pi-blackhole-bridge.patch

apply()  git -C "$SUB" apply --check "$PATCH"  →  refuse and name the commit, else apply
bump()   git -C "$SUB" fetch origin ; checkout origin/HEAD ; git add vendor/pi-blackhole ; apply
```

`apply` needs a copy of pi-blackhole to patch; `bump` exists to keep that copy and the patch in step. The
submodule is what supplies the copy. Nothing in `pi-web-plugin/` touches it — the plugin talks to the
*installed* pi-blackhole over the session event bus, and the vendored tree is only ever used when rebuilding
the bridge.

## Decisions

- **D1 — keep the copy on disk, untracked and gitignored.** The local tree stays where it is so `apply` and
  `bump` keep working for anyone hacking on the bridge, and so no 273 MB directory becomes untracked noise in
  `git status`. It stops being part of the repo.
- **D2 — `bump` loses its pin, keeps its check.** Drop the `git add vendor/pi-blackhole` line; the rest of the
  function (fetch, checkout `origin/HEAD`, `apply`) is unchanged and still refuses when the patch no longer fits.
  Renamed in the help text from "re-pin and apply" to "refresh upstream and check the patch still fits".
- **D3 — provenance moves into the patch itself.** The upstream version and commit the bridge was derived
  against (`pi-blackhole` 0.5.13 @ `1907ede09`) are stated in a header comment of `vendor/pi-blackhole-bridge.patch`
  and in the README, instead of being implied by a submodule pin that a clone cannot see.
- **D4 — the README keeps one install path and moves the rest.** `pi install npm:pi-blackhole` stays the required
  step, so the install section does not change. The "Optional: the pinned source copy" section becomes "Hacking
  on the bridge", which starts by cloning upstream rather than by `git submodule update --init`.
- **D5 — the spec requirement is modified, not replaced.** `Wrapper, not reimplementation` keeps its substance —
  the plugin never restates a key, a range, or a path — and only its clause naming the submodule as the pinned
  component is rewritten. Its `Upstream moves` scenario keeps the refusal and drops the word "pinned".

## Risks / Trade-offs

- **A clone that hacks gets an unpinned tree.** `git clone` + `scripts/bridge.sh apply` against current upstream
  HEAD works only while the patch still fits; when upstream moves, `apply` says so and names the commit. The
  drift guard survives, the exactness of the copy does not.
- **No double-load hazard is introduced.** We are not bundling a copy of pi-blackhole into the package, so the
  session still runs exactly one pi-blackhole, and `pi install npm:pi-blackhole` remains the only source of it.
- **Upstream attribution stays a link, not a shipped file.** The MIT `LICENSE` lived inside the submodule tree,
  which never travelled; removing the submodule does not change that, and the README keeps the link and the
  version/commit the patch was derived against.
