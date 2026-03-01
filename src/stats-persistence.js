"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const SNAPSHOT_FILE = "stats-snapshot.json";
const WAL_FILE = "stats.wal.ndjson";
const SNAPSHOT_VERSION = 1;

const NUMERIC_FIELDS = [
  "templatesFetched",
  "jobBroadcasts",
  "connectionsTotal",
  "sharesAccepted",
  "sharesRejected",
  "sharesStale",
  "sharesDuplicate",
  "sharesLowDiff",
  "blocksFound",
  "blocksRejected",
  "currentHeight",
  "lastTemplateAt",
  "lastTemplateFetchMs",
  "avgTemplateFetchMs",
  "lastBroadcastAt",
  "lastBroadcastClients",
  "lastShareAt",
  "lastFoundBlockAt",
  "bestShareDifficulty",
  "bestShareAt"
];

const STRING_OR_NULL_FIELDS = [
  "currentNetworkBits",
  "lastTemplateSource",
  "lastShareWorker",
  "lastFoundBlockHash",
  "bestShareWorker"
];

class StatsPersistence {
  constructor(config, logger, stats) {
    this.config = config;
    this.logger = logger;
    this.stats = stats;
    this.enabled = Boolean(config.statsPersistenceEnabled);

    const baseDir = path.resolve(process.cwd(), String(config.statsPersistenceDir || "data"));
    this.dir = path.join(baseDir, "stats");
    this.snapshotPath = path.join(this.dir, SNAPSHOT_FILE);
    this.walPath = path.join(this.dir, WAL_FILE);

    this.captureIntervalMs = Math.max(250, Number(config.statsWalCaptureMs || 1000));
    this.flushIntervalMs = Math.max(100, Number(config.statsWalFlushMs || 1000));
    this.checkpointIntervalMs = Math.max(5000, Number(config.statsCheckpointMs || 60000));
    this.recentSharesMax = Math.max(10, Number(config.statsRecentSharesMax || 240));

    this.captureTimer = null;
    this.flushTimer = null;
    this.checkpointTimer = null;
    this.writeChain = Promise.resolve();
    this.pendingRecords = [];
    this.captureSeq = 0;
    this.lastCompactSerialized = "";
  }

  async start() {
    if (!this.enabled) return;
    try {
      await fs.promises.mkdir(this.dir, { recursive: true });
      await this.restoreFromDisk();
      this.lastCompactSerialized = JSON.stringify(makeCompactStats(this.stats));

      this.captureTimer = setInterval(() => this.captureNow(), this.captureIntervalMs);
      this.flushTimer = setInterval(() => { this.scheduleFlush(); }, this.flushIntervalMs);
      this.checkpointTimer = setInterval(() => { this.scheduleCheckpoint("interval"); }, this.checkpointIntervalMs);

      if (typeof this.captureTimer.unref === "function") this.captureTimer.unref();
      if (typeof this.flushTimer.unref === "function") this.flushTimer.unref();
      if (typeof this.checkpointTimer.unref === "function") this.checkpointTimer.unref();

      this.logger.info("Stats persistence enabled", {
        dir: this.dir,
        walCaptureMs: this.captureIntervalMs,
        walFlushMs: this.flushIntervalMs,
        checkpointMs: this.checkpointIntervalMs
      });
    } catch (err) {
      this.enabled = false;
      this.logger.error("Stats persistence disabled after init failure", {
        dir: this.dir,
        error: err && err.message ? err.message : String(err)
      });
    }
  }

  async stop() {
    if (!this.enabled) return;

    if (this.captureTimer) clearInterval(this.captureTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.captureTimer = null;
    this.flushTimer = null;
    this.checkpointTimer = null;

    this.captureNow(true);
    await this.scheduleFlush();
    await this.scheduleCheckpoint("shutdown");
    await this.writeChain;
  }

  captureNow(force) {
    if (!this.enabled) return;

    const compact = makeCompactStats(this.stats);
    const compactSerialized = JSON.stringify(compact);
    if (!force && compactSerialized === this.lastCompactSerialized) {
      return;
    }
    this.lastCompactSerialized = compactSerialized;

    const record = {
      v: SNAPSHOT_VERSION,
      t: Date.now(),
      s: compact
    };
    this.captureSeq += 1;
    this.pendingRecords.push({
      seq: this.captureSeq,
      line: JSON.stringify(record) + "\n"
    });
  }

  scheduleFlush() {
    if (!this.enabled) return this.writeChain;
    if (this.pendingRecords.length === 0) return this.writeChain;

    return this.enqueueDiskTask(async () => {
      if (this.pendingRecords.length === 0) return;
      const batch = this.pendingRecords;
      this.pendingRecords = [];
      const payload = batch.map((entry) => entry.line).join("");
      await fs.promises.appendFile(this.walPath, payload, "utf8");
    });
  }

  scheduleCheckpoint(reason) {
    if (!this.enabled) return this.writeChain;

    return this.enqueueDiskTask(async () => {
      const checkpointSeq = this.captureSeq;
      const snapshot = makeSnapshot(this.stats, this.recentSharesMax);
      await writeJsonAtomic(this.snapshotPath, snapshot);
      await fs.promises.writeFile(this.walPath, "", "utf8");

      // Snapshot now supersedes all records captured up to checkpointSeq.
      this.pendingRecords = this.pendingRecords.filter((entry) => entry.seq > checkpointSeq);
      this.lastCompactSerialized = JSON.stringify(makeCompactStats(this.stats));

      if (reason === "shutdown") {
        this.logger.debug("Stats snapshot written on shutdown");
      }
    });
  }

  enqueueDiskTask(task) {
    this.writeChain = this.writeChain
      .then(task)
      .catch((err) => {
        this.logger.error("Stats persistence I/O failed", {
          error: err && err.message ? err.message : String(err)
        });
      });
    return this.writeChain;
  }

  async restoreFromDisk() {
    let snapshotLoaded = false;
    let walLoaded = false;
    let snapshotSavedAt = 0;

    const snapshot = await readJsonIfExists(this.snapshotPath, this.logger);
    if (snapshot && snapshot.stats && typeof snapshot.stats === "object") {
      applyFullStats(this.stats, snapshot.stats, this.recentSharesMax);
      snapshotLoaded = true;
      snapshotSavedAt = sanitizeNumber(snapshot.savedAt);
    }

    const walRecord = await readLastWalCompactRecord(this.walPath, this.logger);
    if (walRecord && walRecord.s) {
      const walAt = sanitizeNumber(walRecord.t);
      if (!snapshotLoaded || walAt >= snapshotSavedAt) {
        applyCompactStats(this.stats, walRecord.s);
        walLoaded = true;
      } else {
        this.logger.warn("Ignoring stale WAL tail older than snapshot", {
          snapshotSavedAt,
          walAt
        });
      }
    }

    if (snapshotLoaded || walLoaded) {
      this.logger.info("Stats restored from disk", {
        snapshotLoaded,
        walLoaded,
        sharesAccepted: this.stats.sharesAccepted,
        sharesRejected: this.stats.sharesRejected,
        blocksFound: this.stats.blocksFound
      });
    }
  }
}

async function readJsonIfExists(filePath, logger) {
  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    if (logger) {
      logger.warn("Failed to read stats snapshot; ignoring", {
        file: filePath,
        error: err && err.message ? err.message : String(err)
      });
    }
    return null;
  }
}

async function readLastWalCompactRecord(walPath, logger) {
  try {
    await fs.promises.access(walPath, fs.constants.F_OK);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    if (logger) {
      logger.warn("Failed to access stats WAL; ignoring", {
        file: walPath,
        error: err && err.message ? err.message : String(err)
      });
    }
    return null;
  }

  const stream = fs.createReadStream(walPath, { encoding: "utf8" });

  let lastRecord = null;
  let badLines = 0;
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  try {
    for await (const rawLine of rl) {
      const line = String(rawLine || "").trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        const compact = parsed && parsed.s && typeof parsed.s === "object" ? parsed.s : null;
        if (!compact) continue;
        lastRecord = {
          t: sanitizeNumber(parsed.t),
          s: sanitizeCompactStats(compact)
        };
      } catch (err) {
        badLines += 1;
      }
    }
  } catch (err) {
    if (logger) {
      logger.warn("Failed while reading stats WAL; using last valid state", {
        file: walPath,
        error: err && err.message ? err.message : String(err)
      });
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  if (badLines > 0 && logger) {
    logger.warn("Ignored malformed lines in stats WAL", {
      file: walPath,
      badLines
    });
  }

  return lastRecord;
}

function makeSnapshot(stats, recentSharesMax) {
  return {
    v: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    stats: Object.assign(
      {},
      makeCompactStats(stats),
      { recentShares: sanitizeRecentShares(stats && stats.recentShares, recentSharesMax) }
    )
  };
}

function makeCompactStats(stats) {
  const compact = {};
  const src = stats || {};

  for (const field of NUMERIC_FIELDS) {
    compact[field] = sanitizeNumber(src[field]);
  }
  for (const field of STRING_OR_NULL_FIELDS) {
    compact[field] = sanitizeStringOrNull(src[field], 256);
  }

  return compact;
}

function applyFullStats(target, src, recentSharesMax) {
  applyCompactStats(target, src);
  target.recentShares = sanitizeRecentShares(src && src.recentShares, recentSharesMax);
}

function applyCompactStats(target, src) {
  const compact = sanitizeCompactStats(src);
  for (const field of NUMERIC_FIELDS) {
    target[field] = compact[field];
  }
  for (const field of STRING_OR_NULL_FIELDS) {
    target[field] = compact[field];
  }
}

function sanitizeCompactStats(src) {
  const out = {};
  const obj = src || {};
  for (const field of NUMERIC_FIELDS) {
    out[field] = sanitizeNumber(obj[field]);
  }
  for (const field of STRING_OR_NULL_FIELDS) {
    out[field] = sanitizeStringOrNull(obj[field], 256);
  }
  return out;
}

function sanitizeRecentShares(input, maxItems) {
  if (!Array.isArray(input)) return [];
  const safeMax = Math.max(10, Number(maxItems) || 240);
  const sliced = input.slice(-safeMax);
  const out = [];

  for (let i = 0; i < sliced.length; i += 1) {
    const sample = sliced[i] || {};
    out.push({
      t: sanitizeNumber(sample.t),
      type: sample.type === "rejected" ? "rejected" : "accepted",
      difficulty: sanitizeNumber(sample.difficulty),
      worker: sanitizeString(sample.worker, 96),
      reason: sample.reason == null ? null : sanitizeString(sample.reason, 64)
    });
  }

  return out;
}

function sanitizeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizeString(value, maxLen) {
  const s = String(value == null ? "" : value);
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

function sanitizeStringOrNull(value, maxLen) {
  if (value == null) return null;
  return sanitizeString(value, maxLen);
}

async function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  const payload = JSON.stringify(data);
  await fs.promises.writeFile(tmpPath, payload, "utf8");
  await fs.promises.rename(tmpPath, filePath);
}

module.exports = { StatsPersistence };
