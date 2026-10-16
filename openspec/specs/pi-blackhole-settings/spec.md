# Spec: pi-blackhole-settings

## Purpose

A browser extension that allows users to change pi-blackhole settings from the pi-web interface and view indicators (O/P/X token gauges, worker status). The extension renders a settings form with all pi-blackhole config options and a status bar dashboard.

## Requirements

- The extension must render a settings panel with all pi-blackhole config options (50+ settings)
- Each setting must have proper validation: enum dropdowns, numeric ranges with min/max/step, boolean toggles
- Settings must be auto-saved to the config file on every change
- The extension must render a status bar with O/P/X token gauges and worker indicators
- The status bar must display metric explanations for each gauge
- Settings must be applied at global, project, and session levels
- Invalid config values must be rejected before saving

### Requirement: Wrapper, not reimplementation
The web plugin SHALL treat pi-blackhole as a separate, pinned component (a git
submodule) and SHALL obtain the settings schema, the current values, the validation
rules, the save path and the measured gauges from pi-blackhole itself. The plugin
MUST NOT restate a setting key, an option list, a numeric range, or a config file
path of its own.

#### Scenario: Panel shows pi-blackhole's own schema
- **WHEN** the settings panel is opened against a session whose pi-blackhole schema
  has changed since the plugin was written
- **THEN** the panel renders exactly the fields pi-blackhole reports, and no field
  list, range, or path is baked into the plugin

#### Scenario: Upstream moves
- **WHEN** the pinned pi-blackhole copy no longer matches the bridge that was derived
  against it
- **THEN** the bridge tooling refuses to build and names the pinned commit and the
  patch that must be re-derived

### Requirement: Settings panel renders every reported field
The settings panel SHALL render one control per field pi-blackhole reports, choosing
the control from the field's declared type: enum fields become a dropdown of the
reported options, boolean fields become a toggle, numeric fields become a number
input carrying the reported min, max and step, and any other field becomes a text
input.

#### Scenario: Enum field
- **WHEN** pi-blackhole reports an enum field with a set of options
- **THEN** the panel shows a dropdown holding exactly those options, preselected at
  the current value

#### Scenario: Numeric field
- **WHEN** pi-blackhole reports a numeric field with min, max and step
- **THEN** the panel shows a number input carrying those same bounds and step

### Requirement: Writes go through pi-blackhole's validated save
A settings change SHALL be written by pi-blackhole's own save path, which applies its
own validation. The plugin MUST NOT write the config file itself.

#### Scenario: Valid change is saved
- **WHEN** the user selects a different value for a setting and applies the change
- **THEN** pi-blackhole saves the new value and the panel re-reads and shows it

#### Scenario: Invalid value is refused
- **WHEN** the user selects a value pi-blackhole rejects
- **THEN** nothing is saved and the panel shows pi-blackhole's own refusal reason
  verbatim

### Requirement: Unknown settings are refused
A write for a key pi-blackhole does not report SHALL be refused rather than applied or
silently dropped.

#### Scenario: Stale panel key
- **WHEN** a change names a key that is not in the schema pi-blackhole currently reports
- **THEN** the write is refused with a reason naming that key and no other key is written

### Requirement: Scope provenance is visible
For each setting the panel SHALL show which scope (global, project, session) currently
owns the value, using the provenance pi-blackhole reports rather than deriving it.

#### Scenario: Overridden value
- **WHEN** a value is set at project scope over a global default
- **THEN** the panel marks that setting with the project scope as reported by
  pi-blackhole

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

### Requirement: Worker status comes from runtime state
The status bar SHALL render each worker's state and any stage delta exactly as
pi-blackhole reports it, with no inference in the plugin.

#### Scenario: Running worker
- **WHEN** pi-blackhole reports a running worker
- **THEN** the panel marks that worker as running

#### Scenario: Completed stage delta
- **WHEN** pi-blackhole reports a completed stage with a delta
- **THEN** the panel shows that delta

### Requirement: Each gauge explains itself
Every gauge SHALL be labelled with what it measures, in the panel.

#### Scenario: Labelled gauge
- **WHEN** a gauge is rendered
- **THEN** its label states what it counts and what fills it

### Requirement: Opening the panel sends no message to the LLM
Opening or refreshing either panel SHALL NOT send a message to the model; the panels
only request data over the session event bus.

#### Scenario: Panel opened
- **WHEN** the user opens a panel and changes nothing
- **THEN** no message is sent to the model and no setting is written

### Requirement: Unreachable bridge degrades visibly
When pi-blackhole's bridge does not answer, the panels SHALL show a notice stating
that, and MUST NOT fail or block the rest of the pi-web interface.

#### Scenario: Bridge not loaded
- **WHEN** the paired pi-blackhole does not answer within its round-trip budget
- **THEN** the settings panel shows a notice naming the timeout and the bridge, and the
  interface stays usable

### Requirement: Workspace tabs name what they show
Each workspace panel tab of this plugin SHALL be labelled with the words a user says for that panel: the settings
tab reads `blackhole settings` and the status tab reads `blackhole status`. The label MUST NOT carry the package
prefix, and MUST NOT add words beyond what the panel shows.

#### Scenario: Both tabs render
- **WHEN** a workspace shows both panels of this plugin
- **THEN** the two tabs read exactly `blackhole settings` and `blackhole status`

#### Scenario: Label matches the request
- **WHEN** a user asks for the settings of blackhole for a session
- **THEN** the tab they are offered is the one labelled `blackhole settings`, and the tab labelled
  `blackhole status` is the one that shows the gauges

### Requirement: Tab label is independent of panel identity
A panel's stable identity — its id, its order, and the data it reads — SHALL NOT change when its label changes, so
renaming a tab cannot move, duplicate, or re-create the panel it names.

#### Scenario: Rename keeps the panel
- **WHEN** a tab label changes between revisions
- **THEN** the panel behind it keeps its id, its order, and the settings and gauges it reads, and only the words
  on the tab differ

#### Scenario: Label follows activation
- **WHEN** the revision carrying the new labels has been activated and the page reloaded
- **THEN** the tabs read the new labels, and until that activation the tabs keep the labels of the revision in use

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

### Requirement: Turning the readout off explains itself
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

## Scenarios

### Scenario 1: Open settings panel
User opens the pi-blackhole-settings plugin in pi-web and sees the settings form with all config options.

### Scenario 2: Change compaction mode
User selects "manual" for compaction from the settings form and clicks Save. The config file is updated with the new value, and the settings form reflects the change.

### Scenario 3: View status bar
User opens the settings panel and sees the status bar showing O/P/X token gauges and worker spinners. The gauges display current token counts. User can toggle settings and see the gauges update.

### Scenario 4: Auto-save on change
User changes a setting value and the config file is saved automatically without an explicit Save click.

### Scenario 5: Invalid value rejection
User selects an invalid enum value for a setting. The form shows an error message and the invalid value is not saved.
