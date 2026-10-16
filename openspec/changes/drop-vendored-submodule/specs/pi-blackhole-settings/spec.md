# Spec Delta

## Purpose

Stop shipping a pinned copy of pi-blackhole that a clone cannot fetch, and keep the bridge patch as the part
that carries the design.

## MODIFIED Requirements

### Requirement: Wrapper, not reimplementation
The web plugin SHALL treat pi-blackhole as a separate component that the user installs, and SHALL obtain the
settings schema, the current values, the validation rules, the save path and the measured gauges from pi-blackhole
itself. The plugin MUST NOT restate a setting key, an option list, a numeric range, or a config file path of its
own, and MUST NOT carry a copy of pi-blackhole inside the plugin package.

#### Scenario: Panel shows pi-blackhole's own schema
- **WHEN** the settings panel is opened against a session whose pi-blackhole schema has changed since the plugin
  was written
- **THEN** the panel renders exactly the fields pi-blackhole reports, and no field list, range, or path is baked
  into the plugin

#### Scenario: Upstream moves
- **WHEN** the copy of pi-blackhole the bridge is being applied to no longer matches the bridge derived against
  it
- **THEN** the bridge tooling refuses to build, names the commit it was checked against, and states that the patch
  must be re-derived

## ADDED Requirements

### Requirement: The upstream copy the bridge patches is supplied, not shipped
The repository SHALL NOT carry a pinned copy of pi-blackhole, and SHALL carry the bridge patch plus the version
and commit the patch was derived against, so a reader can rebuild the bridge against a copy they fetched.

#### Scenario: A clone carries no vendored tree
- **WHEN** the repository is cloned
- **THEN** no copy of pi-blackhole is fetched with it, and the bridge patch is present

#### Scenario: Provenance is readable
- **WHEN** a reader wants to know which pi-blackhole the published bridge was written against
- **THEN** the patch and the README name the upstream version and commit, without requiring a submodule pin
