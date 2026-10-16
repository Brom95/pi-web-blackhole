// pi-web browser plugin entry (API v4).
//
// The panel never hardcodes pi-blackhole's settings surface: the schema, the
// current values, the validation and the save path all come from pi-blackhole
// itself, over the package peer channel. Opening this panel sends no message to
// the LLM — it is a UI overlay, and the only thing it does is ask the paired
// server entry for data.
//
// The panel also explains itself: which conversation it is reading, what the
// gauge channel is doing right now, and where each number came from. Nothing
// here invents pi-blackhole state; every value is what pi-blackhole reported.

const SETTINGS_OP = "settings";
const GAUGES_OP = "gauges";

// Panel state. Rendered synchronously from here; async fetches write into it.
let fields = [];
let values = {};
let winners = {};
let scopes = {};
let notice = "";
let settingsLoading = false;

// Gauges state. Rendering runs repeatedly without the panel being remounted, so
// the channel is opened once and guarded: gaugeChannel holds the resolved
// channel (only that one can be closed), gaugeOpening marks a pending open, and
// gaugeAbort cancels an open that never resolved.
let gauges = null;
let gaugeChannel = null;
let gaugeOpening = false;
let gaugeAbort;
let gaugeStatus = "";
let gaugeSession = "";
let gaugeFrameAt = 0;

// pi-blackhole owns this setting. The plugin reads only the value pi-blackhole
// reports for it: the schema, the default, the validation and the save path all
// stay pi-blackhole's. The key is named once, here, and nowhere else.
const STATUS_BAR_KEY = "statusBar";

// pi-blackhole's own status readout switch, as pi-blackhole resolved it (the
// payload already carries the winning layer, so an env or scope override is
// honoured without the plugin knowing about it). Absent means on: a renamed or
// unreported key must not silently hide a live readout.
function statusBarReadout() {
  const reported = fields.find((field) => field.key === STATUS_BAR_KEY);
  if (!reported) return { on: true, label: "", winner: "" };
  const value = values[STATUS_BAR_KEY] ?? reported.value;
  return {
    on: value === undefined || value === null ? true : value !== false,
    label: String(reported.label || STATUS_BAR_KEY),
    winner: String(winners[STATUS_BAR_KEY] || ""),
  };
}

function renderStatusOff(html, readout) {
  return html`
    <p class="pi-blackhole-off">
      The status readout is off: pi-blackhole reports ${readout.label} as false, so the
      O/P/X bars and the worker rows are not drawn here. Turn ${STATUS_BAR_KEY} back on in
      the settings panel${readout.winner ? ` (pi-blackhole resolved it from ${readout.winner})` : ""}.
      The gauge channel itself is unaffected — pi-blackhole still publishes frames while the
      readout is off, which is why this panel says "off" rather than "no live session".
    </p>
  `;
}

function closeGaugeChannel() {
  const channel = gaugeChannel;
  gaugeChannel = null;
  gaugeOpening = false;
  const abort = gaugeAbort;
  gaugeAbort = undefined;
  if (abort) {
    try {
      abort.abort();
    } catch {}
  }
  try {
    if (channel) channel.close("panel remount");
  } catch {}
}

async function loadSettings(panel) {
  if (settingsLoading) return;
  settingsLoading = true;
  const peer = panel.peer;
  const sessionId = sessionIdOf(panel);
  if (!sessionId) {
    fields = [];
    values = {};
    winners = {};
    scopes = {};
    notice = "No conversation is selected in this workspace. Open a session tab, and this panel reads that conversation's pi-blackhole settings.";
    settingsLoading = false;
    return;
  }
  // The host rejects inputs carrying undefined, so the key is only sent when a
  // session is actually selected.
  const input = { action: "get" };
  if (sessionId) input.sessionId = sessionId;
  try {
    if (!peer || !peer.request) throw new Error("no package peer on this machine");
    const result = await peer.request(SETTINGS_OP, input);
    fields = Array.from(result.fields || []);
    values = Object.assign({}, result.values || {});
    winners = Object.assign({}, result.winners || {});
    scopes = Object.assign({}, result.scopes || {});
    notice = String(result.notice || "");
  } catch (error) {
    notice = `settings unavailable: ${String(error)}`;
  } finally {
    settingsLoading = false;
    // The fetch is async, so the panel must be re-rendered once it lands.
    panel.host.requestRender();
  }
}

async function applyChanges(panel, changes) {
  const peer = panel.peer;
  if (!peer || !peer.request) return;
  const sessionId = sessionIdOf(panel);
  const input = { action: "set", changes };
  if (sessionId) input.sessionId = sessionId;
  let refusal = "";
  try {
    const result = await peer.request(SETTINGS_OP, input);
    // pi-blackhole replies with its own refusal reason; shown verbatim.
    refusal = String(result.error || result.message || "");
  } catch (error) {
    refusal = String(error);
  }
  // The re-read clears the notice, so the refusal is re-asserted after it.
  await loadSettings(panel);
  notice = refusal;
  panel.host.requestRender();
}

function sessionIdOf(panel) {
  return panel.state?.selectedSession?.id;
}

// What the panels say they are reading: the host's own selection, never a
// guessed session.
function sessionLabel(panel) {
  const session = panel.state?.selectedSession;
  if (!session) return "";
  return String(session.name || session.id);
}

function openGaugesFor(panel) {
  openGauges(panel);
}

async function openGauges(panel) {
  if (gaugeChannel || gaugeOpening) return;
  const sessionId = sessionIdOf(panel);
  gaugeSession = sessionLabel(panel);
  if (!sessionId) {
    gaugeStatus = "No conversation selected — the gauges read a live hosted session.";
    panel.host.requestRender();
    return;
  }
  if (!panel.peer || !panel.peer.openChannel) {
    gaugeStatus = "no paired channel on this machine";
    panel.host.requestRender();
    return;
  }
  gaugeOpening = true;
  gaugeStatus = "connecting…";
  panel.host.requestRender();
  const abort = new AbortController();
  gaugeAbort = abort;
  let channel;
  try {
    channel = await panel.peer.openChannel(GAUGES_OP, { sessionId }, {
      signal: abort.signal,
      onData: (frame) => {
        // Frames arrive asynchronously: ignore ones from a cancelled open, then
        // ask the host to redraw the panel.
        if (abort.signal.aborted) return;
        gauges = frame;
        gaugeFrameAt = Date.now();
        panel.host.requestRender();
      },
    });
  } catch (error) {
    gaugeOpening = false;
    gaugeStatus = `gauges unavailable: ${String(error)}`;
    panel.host.requestRender();
    return;
  }
  if (abort.signal.aborted) {
    try {
      channel.close("cancelled");
    } catch {}
    return;
  }
  gaugeChannel = channel;
  gaugeOpening = false;
  gaugeStatus = "connected — frames arrive as the session runs";
  // The host reports the channel's own close: drop it so a later render can
  // reconnect, and tell the user rather than showing stale gauges silently.
  void channel.closed.then(
    () => {
      if (gaugeChannel !== channel) return;
      gaugeChannel = null;
      gaugeStatus = "the session closed the gauge channel";
      panel.host.requestRender();
    },
    (error) => {
      if (gaugeChannel !== channel) return;
      gaugeChannel = null;
      gaugeStatus = `gauge channel failed: ${String(error)}`;
      panel.host.requestRender();
    },
  );
  panel.host.requestRender();
}

// Stable ids so the apply handler can read what the user actually selected.
function controlId(key) {
  return `pi-blackhole-${key}`;
}

// The panel renders inside a shadow tree, so document.getElementById cannot see
// its controls. Walk the shadow boundaries to find a control by its stable id.
function findById(id) {
  const queue = [[document.body, 0]];
  while (queue.length) {
    const entry = queue.shift();
    const host = entry[0];
    const depth = entry[1];
    if (!host || depth > 25) continue;
    const kids = host.shadowRoot ? host.shadowRoot.children : host.children;
    for (const node of kids) {
      if (node.nodeType !== 1) continue;
      if (node.id === id) return node;
      queue.push([node, depth + 1]);
    }
  }
  return null;
}

function readSelectedValue(key) {
  const element = findById(controlId(key));
  if (!element) return undefined;
  if (element.tagName === "SELECT") return element.value;
  if (element.tagName === "INPUT" && element.type === "checkbox")
    return element.checked;
  return element.value;
}

function collectChanges() {
  const changes = [];
  for (const field of fields) {
    const selected = readSelectedValue(field.key);
    if (selected === undefined) continue;
    if (String(selected) !== String(values[field.key]))
      changes.push({ key: field.key, value: selected });
  }
  return changes;
}

// Shared chrome for both panels: the same palette variables the host uses, so
// the panels sit in the app's own look rather than a box of their own colours.
function panelStyles(html) {
  return html`
    <style>
      .pi-blackhole-meta { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; border: 1px solid var(--pi-border-muted); border-radius: 8px; padding: 8px 12px; margin-bottom: 4px; }
      .pi-blackhole-meta-key { color: var(--pi-muted); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.06em; }
      .pi-blackhole-meta-value { color: var(--pi-text-secondary); }
      .pi-blackhole-notice { color: var(--pi-danger); border: 1px solid var(--pi-border-muted); border-radius: 8px; padding: 6px 10px; }
      .pi-blackhole-mono { font-family: var(--pi-control-font-family); font-size: var(--pi-control-font-size); }
    </style>
  `;
}

function renderSettingsPanel(panel, html) {
  const rows = fields.map((field) => renderField(html, field));
  const session = sessionLabel(panel);
  const statusField = fields.find((field) => field.key === STATUS_BAR_KEY);
  return html`
    ${renderSettingsStyles(html)}
    ${panelStyles(html)}
    <section class="viewer pi-blackhole-settings">
      <p class="pi-blackhole-hint">
        Every field below is pi-blackhole's own schema: options, ranges and
        validation come from pi-blackhole, not from this panel. Saving writes
        through pi-blackhole's ConfigManager.
      </p>
      <div class="pi-blackhole-meta">
        <span class="pi-blackhole-meta-key">Reading session</span>
        <span class="pi-blackhole-meta-value">${session || "none selected — open a session tab in this workspace and the panel follows it"}</span>
        <span class="pi-blackhole-meta-key">Scopes pi-blackhole reports</span>
        <span class="pi-blackhole-meta-value pi-blackhole-mono">${Object.keys(scopes || {}).join(" · ")}</span>
        <span class="pi-blackhole-meta-key">Where a value came from</span>
        <span class="pi-blackhole-meta-value">the small word on the right of each row is the layer pi-blackhole says won that value.</span>
        ${statusField ? html`
          <span class="pi-blackhole-meta-key">Rows that name a terminal surface</span>
          <span class="pi-blackhole-meta-value">pi-blackhole's schema is shared across hosts. A row whose label names a footer or a toast has nothing to draw in this interface — the hosted session reports no terminal UI — so it changes nothing here by itself. ${statusField.label} is the exception this panel makes: here it switches the status panel's readout on and off.</span>
        ` : null}
      </div>
      <div class="pi-blackhole-fields">${rows}</div>
      <button class="pi-blackhole-apply" @click=${() => {
        const changes = collectChanges();
        if (!changes.length) return;
        applyChanges(panel, changes);
      }}>
        Apply changes
      </button>
      ${notice ? html`<p class="pi-blackhole-notice">${notice}</p>` : null}
    </section>
  `;
}

// Left: the option and pi-blackhole's own description of it. Right: the value
// pi-blackhole reports now, with the layer that won it, in one aligned column.
function renderField(html, field) {
  const id = controlId(field.key);
  const current = values[field.key];
  const layer = winners[field.key];
  const title = field.label || field.key;
  const description = field.description
    ? html`<small class="pi-blackhole-desc">${field.description}</small>`
    : null;
  let control;
  if (field.type === "enum") {
    const options = (field.options || []).map((option) => html`
      <option value=${option} ?selected=${String(option) === String(current)}>${option}</option>
    `);
    control = html`<select class="pi-blackhole-select" id=${id}>${options}</select><i class="pi-blackhole-caret">▾</i>`;
  } else if (field.type === "boolean") {
    control = html`<input class="pi-blackhole-check" id=${id} type="checkbox" ?checked=${current === true} />`;
  } else {
    control = html`
      <input class="pi-blackhole-number" id=${id} type="number"
        ?min=${field.min} ?max=${field.max} ?step=${field.step}
        value=${String(current ?? 0)} />
    `;
  }
  return html`
    <div class="pi-blackhole-field">
      <div class="pi-blackhole-option">
        <span class="pi-blackhole-name">${title}</span>
        ${control}
        ${description}
      </div>
      <div class="pi-blackhole-current">
        <span class="pi-blackhole-value pi-blackhole-mono">${String(current ?? "")}</span>
        <span class="pi-blackhole-layer">${layer || ""}</span>
      </div>
    </div>
  `;
}

function renderSettingsStyles(html) {
  return html`
    <style>
      .viewer.pi-blackhole-settings { flex: 1 1 auto; min-height: 0; box-sizing: border-box; display: grid; gap: 10px; padding: 12px; overflow-y: auto; overflow-x: hidden; }
      .viewer.pi-blackhole-settings p { margin: 0; }
      .viewer.pi-blackhole-settings .pi-blackhole-hint { color: var(--pi-muted); font-size: 0.9em; }
      .viewer.pi-blackhole-settings .pi-blackhole-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(90px, auto); gap: 8px 18px; align-content: start; }
      .viewer.pi-blackhole-settings .pi-blackhole-field { display: grid; grid-column: span 2; grid-template-columns: subgrid; gap: 0; border-bottom: 1px solid var(--pi-border-muted); padding: 7px 0; align-items: center; }
      .viewer.pi-blackhole-settings .pi-blackhole-option { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, auto) auto; gap: 2px 10px; align-items: center; }
      .viewer.pi-blackhole-settings .pi-blackhole-name { font-weight: 600; }
      .viewer.pi-blackhole-settings .pi-blackhole-desc { color: var(--pi-muted); font-size: 0.85em; grid-column: 1 / -1; }
      .viewer.pi-blackhole-settings .pi-blackhole-select { appearance: none; -webkit-appearance: none; box-sizing: border-box; font-family: var(--pi-control-font-family); font-size: var(--pi-control-font-size); min-width: 110px; max-width: 220px; background: var(--pi-surface); color: var(--pi-text); border: 1px solid var(--pi-border-muted); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
      .viewer.pi-blackhole-settings .pi-blackhole-select:hover { background: var(--pi-surface-hover); border-color: var(--pi-accent-border); }
      .viewer.pi-blackhole-settings .pi-blackhole-select option { background: var(--pi-surface); color: var(--pi-text); }
      .viewer.pi-blackhole-settings .pi-blackhole-caret { color: var(--pi-muted); pointer-events: none; }
      .viewer.pi-blackhole-settings .pi-blackhole-check { appearance: none; -webkit-appearance: none; box-sizing: border-box; width: 16px; height: 16px; background: var(--pi-surface); border: 1px solid var(--pi-border-muted); border-radius: 5px; cursor: pointer; }
      .viewer.pi-blackhole-settings .pi-blackhole-check:hover { border-color: var(--pi-accent-border); }
      .viewer.pi-blackhole-settings .pi-blackhole-check:checked { background: var(--pi-accent); border-color: var(--pi-accent-border); }
      .viewer.pi-blackhole-settings .pi-blackhole-number { appearance: none; -webkit-appearance: none; box-sizing: border-box; font-family: var(--pi-control-font-family); font-size: var(--pi-control-font-size); min-width: 96px; background: var(--pi-surface); color: var(--pi-text); border: 1px solid var(--pi-border-muted); border-radius: 8px; padding: 3px 10px; }
      .viewer.pi-blackhole-settings .pi-blackhole-number:hover { border-color: var(--pi-accent-border); }
      .viewer.pi-blackhole-settings .pi-blackhole-current { justify-self: end; display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); gap: 2px 10px; justify-items: end; }
      .viewer.pi-blackhole-settings .pi-blackhole-layer { color: var(--pi-muted); font-size: 0.85em; }
      .viewer.pi-blackhole-settings button { font: inherit; cursor: pointer; border: 1px solid var(--pi-border-muted); border-radius: 8px; padding: 6px 12px; background: var(--pi-surface); color: var(--pi-text); }
      .viewer.pi-blackhole-settings button:hover { background: var(--pi-surface-hover); }
    </style>
  `;
}

function renderGauge(html, gauge) {
  const value = Number(gauge.value);
  const max = Number(gauge.max);
  const fill = max > 0 ? Math.min(1, value / max) : 0;
  const cells = 12;
  const filled = Math.round(fill * cells);
  const color = fill >= 1 ? "pi-blackhole-full" : fill >= 0.8 ? "pi-blackhole-high" : "pi-blackhole-ok";
  const left = Math.max(0, max - value);
  return html`
    <div class="pi-blackhole-gauge">
      <span class="pi-blackhole-bar ${color}">${"█".repeat(filled)}${"░".repeat(cells - filled)}</span>
      <span class="pi-blackhole-readout pi-blackhole-mono">${value} / ${max}</span>
      <small class="pi-blackhole-gauge-label">${gauge.title} — pi-blackhole's counters ${gauge.key} against ${gauge.threshold}</small>
      <small class="pi-blackhole-gauge-why">${gauge.why}</small>
      <small class="pi-blackhole-gauge-left pi-blackhole-mono">${fill >= 1 ? `at ${max} — pi-blackhole's ${gauge.threshold} trigger is reached` : `${left} left before ${gauge.threshold} is reached`}</small>
    </div>
  `;
}

function renderStatusStyles(html) {
  return html`
    <style>
      .viewer.pi-blackhole-status { flex: 1 1 auto; min-height: 0; box-sizing: border-box; display: grid; gap: 10px; padding: 12px; overflow-y: auto; overflow-x: hidden; }
      .viewer.pi-blackhole-status p { margin: 0; }
      .viewer.pi-blackhole-status .pi-blackhole-gauges { display: grid; grid-template-columns: minmax(0, 1fr) minmax(90px, auto); gap: 8px 14px; align-content: start; }
      .viewer.pi-blackhole-status .pi-blackhole-gauge { display: grid; grid-column: span 2; grid-template-columns: subgrid; gap: 0; border-bottom: 1px solid var(--pi-border-muted); padding: 7px 0; align-items: center; }
      .viewer.pi-blackhole-status .pi-blackhole-bar { font-family: var(--pi-control-font-family); font-size: var(--pi-control-font-size); letter-spacing: -1px; }
      .viewer.pi-blackhole-status .pi-blackhole-ok { color: var(--pi-muted); }
      .viewer.pi-blackhole-status .pi-blackhole-high { color: var(--pi-warning); }
      .viewer.pi-blackhole-status .pi-blackhole-full { color: var(--pi-danger); }
      .viewer.pi-blackhole-status .pi-blackhole-gauge-label { color: var(--pi-muted); grid-column: 1 / -1; }
      .viewer.pi-blackhole-status .pi-blackhole-gauge-why { color: var(--pi-text-secondary); font-size: 0.85em; grid-column: 1 / -1; }
      .viewer.pi-blackhole-status .pi-blackhole-gauge-left { color: var(--pi-muted); font-size: 0.85em; grid-column: 1 / -1; }
      .viewer.pi-blackhole-status .pi-blackhole-explain { color: var(--pi-text-secondary); font-size: 0.9em; }
      .viewer.pi-blackhole-status .pi-blackhole-worker { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; border: 1px solid var(--pi-border-muted); border-radius: 8px; padding: 6px 10px; }
      .viewer.pi-blackhole-status .pi-blackhole-worker-state { font-weight: 600; }
      .viewer.pi-blackhole-status .pi-blackhole-running { color: var(--pi-warning); }
      .viewer.pi-blackhole-status .pi-blackhole-done { color: var(--pi-success); }
      .viewer.pi-blackhole-status .pi-blackhole-empty { color: var(--pi-muted); }
      .viewer.pi-blackhole-status .pi-blackhole-off { color: var(--pi-warning); border: 1px solid var(--pi-warning-border); border-radius: 8px; padding: 8px 12px; }
    </style>
  `;
}

function renderStatusPanel(html) {
  const readout = statusBarReadout();
  const memoryOn = gauges && gauges.memoryOn !== false;
  const gaugeRows = [];
  if (readout.on && gauges) {
    if (memoryOn) {
      gaugeRows.push(renderGauge(html, {
        title: "O",
        key: "obsSince",
        threshold: "observeAfterTokens",
        why: "Tokens of transcript the session has produced since pi-blackhole last ran its observer over them. The bar fills while the session talks; at the threshold the observer runs and the count restarts.",
        value: gauges.obsSince,
        max: gauges.observeAfterTokens,
      }));
      gaugeRows.push(renderGauge(html, {
        title: "P",
        key: "pool",
        threshold: "observationsPoolMaxTokens",
        why: "How full pi-blackhole's observation pool is. Observations wait there until compaction folds them into memory; a full pool means there is no room left to fold.",
        value: gauges.pool,
        max: gauges.observationsPoolMaxTokens,
      }));
    }
    gaugeRows.push(renderGauge(html, {
      title: "X",
      key: "ctxTokens",
      threshold: "compactThreshold",
      why: "Context tokens since the last compaction — what the model is carrying right now. When this bar fills, pi-blackhole compacts and the count drops back down.",
      value: gauges.ctxTokens,
      max: gauges.compactThreshold,
    }));
  }
  const frameAge = gaugeFrameAt ? Math.max(0, Math.round((Date.now() - gaugeFrameAt) / 1000)) : 0;
  const workers = readout.on
    ? (gauges?.workers || []).map((worker) => html`
      <div class="pi-blackhole-worker">
        <span class="pi-blackhole-worker-state ${worker.kind === "running" ? "pi-blackhole-running" : "pi-blackhole-done"}">${worker.kind === "running" ? "running" : "done"}</span>
        <span class="pi-blackhole-worker-detail">${worker.type}${worker.kind === "done" && worker.delta != null ? ` — collected ${worker.delta}` : ""}${worker.note ? ` — ${worker.note}` : ""}</span>
      </div>
    `)
    : [];
  const compactLeft = gauges ? Math.max(0, Number(gauges.compactThreshold) - Number(gauges.ctxTokens)) : 0;
  return html`
    ${renderStatusStyles(html)}
    ${panelStyles(html)}
    <section class="viewer pi-blackhole-status">
      <p class="pi-blackhole-explain">
        These bars are pi-blackhole's own counters, streamed from the hosted session over the gauge channel.
        This panel measures nothing: it draws what pi-blackhole reported and names the counters it drew.
      </p>
      <div class="pi-blackhole-meta">
        <span class="pi-blackhole-meta-key">Reading session</span>
        <span class="pi-blackhole-meta-value">${gaugeSession || "none selected — switch the selected conversation to read another session"}</span>
        <span class="pi-blackhole-meta-key">Gauge channel</span>
        <span class="pi-blackhole-meta-value pi-blackhole-mono">${gaugeStatus || "not opened"}</span>
        ${readout.on ? html`
          <span class="pi-blackhole-meta-key">Last frame</span>
          <span class="pi-blackhole-meta-value pi-blackhole-mono">${gauges ? `${frameAge}s ago` : "none received yet"}</span>
          <span class="pi-blackhole-meta-key">Observation memory</span>
          <span class="pi-blackhole-meta-value">${memoryOn ? "on — O and P bars are counted" : "off — pi-blackhole reports memoryOn: false, so O and P are not counted"}</span>
          <span class="pi-blackhole-meta-key">Last compaction</span>
          <span class="pi-blackhole-meta-value">${gauges ? `${Number(gauges.ctxTokens)} tokens ago — ${compactLeft} before pi-blackhole's next one (compactThreshold ${Number(gauges.compactThreshold)})` : "no frame received yet"}</span>
          <span class="pi-blackhole-meta-key">Observers</span>
          <span class="pi-blackhole-meta-value">${workers.length ? "see the rows below — each names what that stage collected" : "none in the last frame — pi-blackhole keeps a row only while a stage runs and until it settles"}</span>
        ` : null}
      </div>
      <div class="pi-blackhole-gauges">${gaugeRows}</div>
      ${readout.on && workers.length ? html`<p class="pi-blackhole-explain">Workers below are pi-blackhole's own runtime state, not this panel's guess. "collected N" is how many items that stage produced.</p>` : null}
      ${readout.on ? workers : null}
      ${readout.on ? (gauges ? null : html`<p class="pi-blackhole-empty">No frame has arrived yet — pi-blackhole publishes one when the hosted session starts, ends a turn, or compacts.</p>`) : renderStatusOff(html, readout)}
    </section>
  `;
}

const plugin = {
  apiVersion: 4,
  name: "pi-blackhole",
  activate: (context) => ({
    contributions: {
      workspacePanels: [
        {
          id: "settings",
          title: "blackhole settings",
          icon: context.svg `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 8h16"></path>
              <path d="M4 16h16"></path>
              <circle cx="9" cy="8" r="2.5"></circle>
              <circle cx="15" cy="16" r="2.5"></circle>
            </svg>
          `,
          order: 1,
          render: (panel) => {
            void loadSettings(panel);
            return renderSettingsPanel(panel, context.html);
          },
          onInvalidate: (panel) => {
            void loadSettings(panel);
          },
        },
        {
          id: "status",
          title: "blackhole status",
          icon: context.svg `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 17a8 8 0 0 1 16 0"></path>
              <path d="M12 17l4-5"></path>
            </svg>
          `,
          order: 2,
          // The status bar needs one thing from the settings round trip: pi-blackhole's
          // own status readout switch. Same shared state, same guard, same transport —
          // this panel is not a second reader of pi-blackhole, it is the same read.
          render: (panel) => {
            void loadSettings(panel);
            openGaugesFor(panel);
            return renderStatusPanel(context.html);
          },
          onInvalidate: (panel) => {
            void loadSettings(panel);
            openGaugesFor(panel);
          },
        },
      ],
    },
    dispose: () => {
      closeGaugeChannel();
    },
  }),
};

export { plugin as default };
