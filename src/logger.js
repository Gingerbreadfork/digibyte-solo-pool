"use strict";

const os = require("node:os");
const util = require("node:util");

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

const RESERVED_KEYS = new Set(["ts", "level", "msg"]);

function serializeError(error) {
  if (!error || typeof error !== "object") return error;
  const out = {
    name: error.name || "Error",
    message: error.message || String(error)
  };
  if (error.code !== undefined) out.code = error.code;
  if (error.stack) out.stack = error.stack;
  if (error.cause !== undefined) {
    out.cause = error.cause instanceof Error
      ? serializeError(error.cause)
      : error.cause;
  }
  return out;
}

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, v) => {
    if (typeof v === "bigint") return String(v);
    if (v instanceof Error) return serializeError(v);
    if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
    if (Buffer.isBuffer(v)) return { type: "Buffer", length: v.length };
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
    }
    return v;
  });
}

function formatValuePretty(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "string") {
    return /\s/.test(value) ? JSON.stringify(value) : value;
  }
  if (t === "number" || t === "boolean" || t === "bigint") {
    return String(value);
  }
  return util.inspect(value, {
    depth: 4,
    compact: true,
    breakLength: 120,
    colors: false,
    sorted: true
  });
}

function toPrettyLine(payload) {
  const level = String(payload.level || "info").toUpperCase().padEnd(5);
  const ts = payload.ts || new Date().toISOString();
  const component = payload.component ? ` [${payload.component}]` : "";
  const msg = payload.msg || "";
  const fieldKeys = Object.keys(payload).filter((k) => ![
    "ts",
    "level",
    "msg",
    "component",
    "service",
    "hostname",
    "pid"
  ].includes(k));
  fieldKeys.sort();
  if (fieldKeys.length === 0) {
    return `${ts} ${level}${component} ${msg}`;
  }
  const tail = fieldKeys.map((key) => `${key}=${formatValuePretty(payload[key])}`).join(" ");
  return `${ts} ${level}${component} ${msg} | ${tail}`;
}

function writeLine(level, line) {
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
    return;
  }
  process.stdout.write(line + "\n");
}

function normalizeFields(fields) {
  const out = {};
  if (!fields || typeof fields !== "object") return out;
  for (const key of Object.keys(fields)) {
    const normalizedKey = RESERVED_KEYS.has(key) ? `field_${key}` : key;
    out[normalizedKey] = fields[key];
  }
  return out;
}

function mergeContexts(parent, child) {
  const merged = Object.assign({}, parent || {});
  if (!child || typeof child !== "object") return merged;

  const next = normalizeFields(child);
  if (merged.component && next.component) {
    const parentComponent = String(merged.component);
    const childComponent = String(next.component);
    if (childComponent !== parentComponent && !childComponent.startsWith(`${parentComponent}.`)) {
      next.component = `${parentComponent}.${childComponent}`;
    }
  }
  return Object.assign(merged, next);
}

function resolveLogFormat(configuredFormat) {
  const value = String(configuredFormat || process.env.LOG_FORMAT || "auto").toLowerCase();
  if (value === "json" || value === "pretty") return value;
  if (value !== "auto") return "json";
  return process.stdout.isTTY ? "pretty" : "json";
}

function createScopedLogger(threshold, logFormat, context) {
  const enabled = (level) => (LEVELS[level] || LEVELS.info) >= threshold;

  function log(level, message, fields) {
    if (!enabled(level)) return;

    const payload = Object.assign({
      ts: new Date().toISOString(),
      level,
      msg: String(message)
    }, context || {});

    if (fields && typeof fields === "object") {
      Object.assign(payload, normalizeFields(fields));
    } else if (fields !== undefined) {
      payload.field_value = fields;
    }

    const line = logFormat === "pretty"
      ? toPrettyLine(payload)
      : safeStringify(payload);
    writeLine(level, line);
  }

  return {
    child(componentOrFields, extraFields) {
      const childFields = {};
      if (typeof componentOrFields === "string") {
        childFields.component = componentOrFields;
      } else if (componentOrFields && typeof componentOrFields === "object") {
        Object.assign(childFields, componentOrFields);
      }
      if (extraFields && typeof extraFields === "object") {
        Object.assign(childFields, extraFields);
      }
      return createScopedLogger(threshold, logFormat, mergeContexts(context, childFields));
    },
    debug(message, fields) {
      log("debug", message, fields);
    },
    info(message, fields) {
      log("info", message, fields);
    },
    warn(message, fields) {
      log("warn", message, fields);
    },
    error(message, fields) {
      log("error", message, fields);
    }
  };
}

function createLogger(options) {
  const opts = options && typeof options === "object" ? options : {};
  const configuredLevel = String(opts.level || process.env.LOG_LEVEL || "info").toLowerCase();
  const threshold = LEVELS[configuredLevel] || LEVELS.info;
  const logFormat = resolveLogFormat(opts.format);
  const rootContext = mergeContexts({
    service: process.env.LOG_SERVICE || "digibyte-solo-stratum-pool",
    hostname: os.hostname(),
    pid: process.pid
  }, opts.fields || {});

  return createScopedLogger(threshold, logFormat, rootContext);
}

module.exports = { createLogger };
