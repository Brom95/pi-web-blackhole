# Spec Delta

## ADDED Requirements

### Requirement: The last frame the panel receives is kept
The plugin SHALL keep the last gauge frame it received for a conversation, and that record SHALL
survive a page reload, a plugin revision change, and a session daemon restart. The record SHALL
name the conversation it belongs to and when the frame was taken. Only a frame the session actually
published MAY create or replace the record; nothing the plugin itself measures may take its place.

#### Scenario: A reload keeps the last frame
- **WHEN** the page is reloaded and the session has published a frame since it started
- **THEN** the record for that conversation is still there and names the moment the frame was taken

#### Scenario: A restart keeps the last frame
- **WHEN** the session daemon restarts and the session had published a frame before it did
- **THEN** the record is still there afterwards

#### Scenario: A failed open writes nothing
- **WHEN** the gauge channel fails to open or closes without publishing a frame
- **THEN** no record is created or replaced from that attempt

### Requirement: A cached frame is never presented as live
When the status tab draws a frame from the cache rather than one received for the page it is on, it
SHALL name that the reading is cached, say when it was taken, and say which conversation it belongs
to. The tab MUST NOT draw a cached frame in the same shape as a live one.

#### Scenario: Cached frame drawn
- **WHEN** the tab draws a cached frame because nothing arrived for the selected conversation
- **THEN** the reading is labelled as cached with its age and the conversation it belongs to

#### Scenario: Live frame replaces the label
- **WHEN** a frame arrives for the selected conversation
- **THEN** the tab draws it as live and no longer carries the cached label

### Requirement: A cached frame from another conversation is not shown
The status tab SHALL draw a cached frame only for the conversation that frame belongs to. A cached
frame from a conversation the user is not looking at MUST NOT be drawn for it.

#### Scenario: Another conversation is selected
- **WHEN** the selected conversation has no record and another conversation's frame is cached
- **THEN** the tab shows no numbers from that other conversation

#### Scenario: The conversation has its own record
- **WHEN** the selected conversation has a record of its own
- **THEN** the tab draws that record and not one from any other conversation

## MODIFIED Requirements

### Requirement: Status bar shows the measured gauges
The status bar SHALL render the O, P and X gauges from the gauge state pi-blackhole already
measures for its own status bar, and MUST NOT recompute token math in the plugin. The gauges render
only while pi-blackhole reports its own status readout switch as on. Where no frame arrived for the
selected conversation, the bar MAY draw the kept frame for that conversation instead, labelled as
cached.

#### Scenario: Gauges render live values
- **WHEN** a live session is selected, pi-blackhole publishes gauge state, and pi-blackhole reports
  the status readout switch as on
- **THEN** the panel shows O, P and X gauges with the values pi-blackhole published

#### Scenario: No live session
- **WHEN** no session is selected, or no gauge state has arrived for the selected session and no
  frame is kept for it
- **THEN** the panel states that no live gauges are available and shows no invented numbers

#### Scenario: Cached frame drawn instead
- **WHEN** no frame arrived for the selected session, a frame is kept for it, and pi-blackhole
  reports the status readout switch as on
- **THEN** the panel draws those gauges from the kept frame and labels the reading as cached

#### Scenario: Switch reported off
- **WHEN** pi-blackhole reports the status readout switch as off
- **THEN** the panel shows no gauges and no invented numbers
