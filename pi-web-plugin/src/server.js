// pi-web server plugin entry (API v3).
//
// This entry owns no pi-blackhole knowledge of its own. It relays to pi-blackhole's
// own Pi extension over the hosted session's event bus, so schema, validation and
// saving stay inside pi-blackhole (its ConfigManager singleton), and the O/P/X
// gauges stay whatever pi-blackhole's status bar already computes.

import { PI_WEB_HOST_PI_SESSION_EVENTS_CAPABILITY } from "@jmfederico/pi-web/server-plugin-api";

const SETTINGS_CHANNEL = "pi-blackhole-web:settings";
const SETTINGS_REPLY = "pi-blackhole-web:settings-reply";
const GAUGES_CHANNEL = "pi-blackhole:gauges";

let events;

function selectionOf(request) {
  return {
    projectId: request.workspace.projectId,
    workspaceId: request.workspace.id,
    sessionId: request.input?.sessionId,
  };
}

async function connect(request) {
  const selection = selectionOf(request);
  if (!selection.sessionId) throw new Error("no session selected");
  return await events.connect(selection);
}

const ROUND_TRIP_MS = 5_000;

// The host validates a plugin result as JSON-only and rejects records whose
// prototype is not this realm's Object.prototype, which is what a payload
// built inside pi-blackhole's own module root looks like. The frame is JSON
// data, so it is reified in this realm at the boundary; nothing is reshaped.
function asLocalJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function roundTrip(connection, channel, replyChannel, payload) {
  let resolveFrame;
  const pending = new Promise((next) => {
    resolveFrame = next;
  });
  // Subscribe before emitting: a reply may arrive synchronously.
  const unsubscribe = connection.on(replyChannel, (frame) => resolveFrame(frame));
  try {
    connection.emit(channel, payload);
    const timer = setTimeout(
      () => resolveFrame({
        error:
          "pi-blackhole did not answer within " + ROUND_TRIP_MS + "ms — its web bridge is not loaded",
      }),
      ROUND_TRIP_MS,
    );
    try {
      return asLocalJson(await pending);
    } finally {
      clearTimeout(timer);
    }
  } finally {
    try {
      unsubscribe();
    } catch {}
  }
}

async function handleSettings(request) {
  const connection = await connect(request);
  try {
    const action = request.input?.action;
    const payload =
      action === "set"
        ? { action: "set", changes: request.input.changes || [] }
        : { action: "get" };
    const reply = await roundTrip(connection, SETTINGS_CHANNEL, SETTINGS_REPLY, payload, request.signal);
    return reply;
  } finally {
    connection.close();
  }
}

async function handleGauges(channelContext) {
  const connection = await connect(channelContext);
  const unsubscribe = connection.on(GAUGES_CHANNEL, (frame) => {
    channelContext.send(asLocalJson(frame));
  });
  // The host requires a channel object: receive consumes browser frames (the
  // panel sends none), close detaches the subscription and the connection.
  return {
    receive: () => {},
    close: () => {
      try {
        unsubscribe();
      } catch {}
      try {
        connection.close();
      } catch {}
    },
  };
}

const plugin = {
  apiVersion: 3,
  name: "pi-blackhole",
  requires: [PI_WEB_HOST_PI_SESSION_EVENTS_CAPABILITY],
  activate: (context) => ({
    start: (startContext) => {
      events = startContext.capabilities.resolve(PI_WEB_HOST_PI_SESSION_EVENTS_CAPABILITY);
    },
    peer: {
      request: (request) => {
        if (request.operation !== "settings") throw new Error(`unknown operation ${request.operation}`);
        return handleSettings(request);
      },
      openChannel: (channelContext) => {
        if (channelContext.operation !== "gauges") throw new Error(`unknown channel ${channelContext.operation}`);
        return handleGauges(channelContext);
      },
    },
    dispose: () => {
      events = undefined;
    },
  }),
};

export { plugin as default };
