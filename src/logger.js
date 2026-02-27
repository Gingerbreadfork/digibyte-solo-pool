"use strict";

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

function write(level, message, fields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message
  };

  if (fields && typeof fields === "object") {
    for (const key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        payload[key] = fields[key];
      }
    }
  }

  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
    return;
  }
  process.stdout.write(line + "\n");
}

function createLogger() {
  const configured = String(process.env.LOG_LEVEL || "info").toLowerCase();
  const threshold = LEVELS[configured] || LEVELS.info;

  const enabled = (level) => (LEVELS[level] || LEVELS.info) >= threshold;
  return {
    debug(message, fields) {
      if (enabled("debug")) {
        write("debug", message, fields);
      }
    },
    info(message, fields) {
      if (enabled("info")) write("info", message, fields);
    },
    warn(message, fields) {
      if (enabled("warn")) write("warn", message, fields);
    },
    error(message, fields) {
      if (enabled("error")) write("error", message, fields);
    }
  };
}

module.exports = { createLogger };
