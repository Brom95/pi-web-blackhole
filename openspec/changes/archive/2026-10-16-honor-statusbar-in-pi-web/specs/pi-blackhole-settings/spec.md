# Spec Delta

## MODIFIED Requirements

### Requirement: Status bar shows the measured gauges
The status bar SHALL render the O, P and X gauges from the gauge state pi-blackhole
already measures for its own status bar, and MUST NOT recompute token math in the
plugin. The gauges render only while pi-blackhole reports its own status readout
switch as on.

#### Scenario: Gauges render live values
- **WHEN** a live session is selected, pi-blackhole publishes gauge state, and
  pi-blackhole reports the status readout switch as on
- **THEN** the panel shows O, P and X gauges with the values pi-blackhole published

#### Scenario: No live session
- **WHEN** no session is selected or no gauge state has arrived
- **THEN** the panel states that no live gauges are available and shows no invented
  numbers

#### Scenario: Switch reported off
- **WHEN** pi-blackhole reports the status readout switch as off
- **THEN** the panel shows no gauges and no invented numbers

## ADDED Requirements

### Requirement: The switch that governs the readout is pi-blackhole's own
The plugin SHALL take the state of the status readout switch from what pi-blackhole
reports for that setting, and MUST NOT own, default, or restate the setting's schema,
type, or default value. The value read SHALL already include whatever layer pi-blackhole
resolved it from.

#### Scenario: Value read from the reported payload
- **WHEN** the panel needs to know whether the status readout is on
- **THEN** it reads the effective value pi-blackhole reported for the setting, together
  with the layer that value came from

#### Scenario: A switch set outside the panel is still honoured
- **WHEN** the setting was resolved by pi-blackhole from a layer the panel never wrote
  (a scope the panel did not choose, or an environment override)
- **THEN** the panel still reflects that resolved value

#### Scenario: The setting is not reported
- **WHEN** pi-blackhole reports no such setting in its payload
- **THEN** the panel treats the readout as on and states nothing about the switch

### Requirement: Rows that name a surface this interface lacks are explained
The settings panel SHALL state once, in its meta block, that a row whose label names a
terminal surface has nothing to draw in this interface, and SHALL name pi-blackhole's own
reported `label` for the row this panel honours. It MUST NOT restate or rewrite pi-blackhole's
own description text for the row, and MUST NOT add the line when pi-blackhole reports no such
row.

#### Scenario: The line appears while the row is reported
- **WHEN** the settings panel renders and pi-blackhole's payload carries the row
- **THEN** the meta block states that a terminal-surface row has nothing to draw here and names
  the row's reported label as the exception this panel makes

#### Scenario: The line is absent when the row is not reported
- **WHEN** pi-blackhole's payload carries no such row
- **THEN** the meta block states nothing about terminal surfaces and the remaining rows render
  unchanged
When pi-blackhole reports the status readout switch as off, the status panel SHALL say
so in the panel and name the setting the user can turn back on. It MUST NOT present an
empty panel, and MUST NOT hide the tab.

#### Scenario: Off state is legible
- **WHEN** the panel renders with the switch reported off
- **THEN** it states that the status readout is off and names the setting responsible

#### Scenario: The tab remains reachable
- **WHEN** the switch is off
- **THEN** the status tab is still present and selectable

#### Scenario: Turning it back on restores the gauges
- **WHEN** the switch is reported on again and gauge state arrives
- **THEN** the gauges render as they do today
