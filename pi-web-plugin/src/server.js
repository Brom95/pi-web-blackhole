// pi-web server plugin entry (API v3).
//
// This entry owns no pi-blackhole knowledge of its own. It relays to pi-blackhole's
// own Pi extension over the hosted session's event bus, so schema, validation and
// saving stay inside pi-blackhole (its ConfigManager singleton), and the O/P/X
// gauges stay whatever pi-blackhole's status bar already computes.

import { PI_WEB_HOST_PI_SESSION_EVENTS_CAPABILITY } from "@jmfederico/pi-web/server-plugin-api";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SETTINGS_CHANNEL = "pi-blackhole-web:settings";
const SETTINGS_REPLY = "pi-blackhole-web:settings-reply";
const GAUGES_CHANNEL = "pi-blackhole:gauges";

// The last frame is kept per conversation in the host's plugin data directory,
// and read back over its own operation so the panel can offer a cached reading
// after a reload. Only the newest conversations are kept.
const CACHE_OP = "cached";
const CACHE_DIR = "gauge-cache";
const CACHE_RECORDS = 24;

let events;
let dataDir;

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

// The last frame each conversation published, kept so a reload can still show
// what pi-blackhole measured. One file per conversation, in the host's plugin
// data directory; the plugin owns the format. A session id is an opaque token
// from the host, so it is only ever used as a validated file name.
function recordName(sessionId) {
  const name = String(sessionId);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(name)) return "";
  return `${name}.json`;
}

function recordDirectory() {
  if (!dataDir) return "";
  return join(dataDir, CACHE_DIR);
}

async function writeRecord(sessionId, frame) {
  const directory = recordDirectory();
  const name = recordName(sessionId);
  if (!directory || !name) return Promise.resolve();
  const path = join(directory, name);
  const record = { version: 1, sessionId, at: Date.now(), frame };
  const temporary = `${path}.writing`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporary, JSON.stringify(record));
  await rename(temporary, path);
  await pruneRecords(directory);
  return Promise.resolve();
}

// Only the newest conversations are kept, so switching sessions all day cannot
// grow the data directory without limit.
async function pruneRecords(directory) {
  let names;
  try {
    names = await readdir(directory);
  } catch {
    return;
  }
  const dated = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      dated.push({ name, at: (await stat(join(directory, name))).mtimeMs });
    } catch {
      continue;
    }
  }
  dated.sort((a, b) => b.at - a.at);
  for (const stale of dated.slice(CACHE_RECORDS)) {
    try {
      await rm(join(directory, stale.name), { recursive: true, force: true });
    } catch {}
  }
}

// A missing, unreadable or corrupt record reads as no record and never fails
// the request, so the panel falls back to what it shows today.
async function readRecord(sessionId) {
  const directory = recordDirectory();
  const name = recordName(sessionId);
  if (!directory || !name) return null;
  let raw;
  try {
    raw = await readFile(join(directory, name), "utf8");
  } catch {
    return null;
  }
  try {
    const record = JSON.parse(raw);
    if (!record || record.version !== 1) return null;
    // The record names its own conversation, and it must be the one asked for:
    // a record is never handed to a different conversation.
    if (String(record.sessionId || "") !== String(sessionId)) return null;
    if (!record.frame || typeof record.frame !== "object") return null;
    return asLocalJson({ sessionId: record.sessionId, at: record.at, frame: record.frame });
  } catch {
    return null;
  }
}

async function handleCache(request) {
  const selection = selectionOf(request);
  if (!selection.sessionId) return {};
  const record = await readRecord(selection.sessionId);
  if (!record) return {};
  return record;
}


async function handleGauges(channelContext) {
  const connection = await connect(channelContext);
  const unsubscribe = connection.on(GAUGES_CHANNEL, (frame) => {
    const local = asLocalJson(frame);
    channelContext.send(local);
    // The record is written only where a frame actually landed, so a failed or
    // cancelled open, or a channel that closed without publishing, never writes
    // or replaces one. The browser already got the frame, so a cache miss must
    // not break the subscription.
    try {
      const sessionId = selectionOf(channelContext).sessionId;
      if (sessionId) void writeRecord(sessionId, local).catch(() => {});
    } catch {}
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
  activate: (context) => {
    dataDir = context.dataDirectory;
    return {
      start: (startContext) => {
        events = startContext.capabilities.resolve(PI_WEB_HOST_PI_SESSION_EVENTS_CAPABILITY);
      },
      peer: {
        request: (request) => {
          if (request.operation === "settings") return handleSettings(request);
          if (request.operation === CACHE_OP) return handleCache(request);
          throw new Error(`unknown operation ${request.operation}`);
        },
        openChannel: (channelContext) => {
          if (channelContext.operation !== "gauges") throw new Error(`unknown channel ${channelContext.operation}`);
          return handleGauges(channelContext);
        },
      },
      dispose: () => {
        events = undefined;
        dataDir = undefined;
      },
    };
  },
};

export { plugin as default };
