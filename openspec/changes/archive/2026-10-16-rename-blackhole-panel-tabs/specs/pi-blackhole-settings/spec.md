# Spec Delta

## Purpose

Name the workspace tabs by what they show, so the words a user reads on a tab are the words they use when asking
for blackhole's settings or status.

## ADDED Requirements

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
