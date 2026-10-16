# Spec Delta

## Purpose

Lets users change pi-blackhole settings and watch its O/P/X gauges from inside the
pi-web browser, without sending a message to the LLM, while pi-blackhole remains the
single source of truth for the settings surface.

## ADDED Requirements

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
plugin.

#### Scenario: Gauges render live values
- **WHEN** a live session is selected and pi-blackhole publishes gauge state
- **THEN** the panel shows O, P and X gauges with the values pi-blackhole published

#### Scenario: No live session
- **WHEN** no session is selected or no gauge state has arrived
- **THEN** the panel states that no live gauges are available and shows no invented
  numbers

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
