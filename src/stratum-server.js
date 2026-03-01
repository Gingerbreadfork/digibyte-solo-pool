"use strict";

const net = require("node:net");
const { EventEmitter } = require("node:events");
const {
  parsePasswordKv,
  safeJsonParse,
  nowMs,
  formatPrevhashForStratum,
  normalizeHex,
  toFixedHexU32
} = require("./utils");

const SERVER_VERSION_ROLLING_MASK_HEX = "1fffe000";

const STRATUM_ERRORS = {
  unauthorized: [24, "Unauthorized worker", null],
  notsubscribed: [25, "Not subscribed", null],
  stale: [21, "Stale share", null],
  duplicate: [22, "Duplicate share", null],
  lowdiff: [23, "Low difficulty share", null],
  invalid: [20, "Invalid share", null]
};
const EMPTY_BUFFER = Buffer.alloc(0);
const MAX_RECENT_SHARE_SAMPLES = 240;

/**
 * Stratum V1 server for mining pool protocol.
 *
 * Worker Name Format:
 * Supports the standard pool convention of "address.workername":
 * - "DGBAddress.bitaxe1" -> address: "DGBAddress", worker: "bitaxe1"
 * - "myworker" -> address: "myworker", worker: "myworker"
 *
 * This allows miners to run multiple devices with different names
 * while using the same address/username.
 */
class StratumServer extends EventEmitter {
  constructor(config, logger, jobManager, stats) {
    super();
    this.config = config;
    this.logger = logger;
    this.jobManager = jobManager;
    this.stats = stats;

    this.server = null;
    this.clients = new Map();
    this.clientSeq = 0;
    this.extranonceCounter = 0n;

    // Rate limiting and connection tracking
    this.connectionsByIp = new Map(); // IP -> Set of client IDs
    this.connectionAttempts = new Map(); // IP -> Array of timestamps
    this.rateLimitCleanupInterval = null;
    if (!Array.isArray(this.stats.recentShares)) {
      this.stats.recentShares = [];
    }
  }

  start() {
    this.server = net.createServer((socket) => this.handleConnection(socket));
    this.server.on("error", (err) => {
      this.logger.error("Stratum server error", { error: err.message });
      this.emit("error", err);
    });

    this.jobManager.on("job", (job) => {
      this.broadcastJob(job);
    });

    // Cleanup rate limit tracking every minute
    this.rateLimitCleanupInterval = setInterval(() => {
      this.cleanupRateLimitTracking();
    }, 60000);

    this.server.listen(this.config.stratumPort, this.config.stratumHost, () => {
      this.logger.info("Stratum listening", {
        host: this.config.stratumHost,
        port: this.config.stratumPort,
        maxClients: this.config.maxClients,
        maxClientsPerIp: this.config.maxClientsPerIp,
        rateLimitPerMin: this.config.connectionRateLimitPerMin
      });
    });
  }

  stop() {
    for (const client of this.clients.values()) {
      client.socket.destroy();
    }
    this.clients.clear();
    this.connectionsByIp.clear();
    this.connectionAttempts.clear();
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  snapshot() {
    let authorized = 0;
    let subscribed = 0;
    const workers = [];
    const now = nowMs();

    for (const c of this.clients.values()) {
      if (c.authorized) authorized += 1;
      if (c.subscribed) subscribed += 1;

      if (c.authorized) {
        workers.push({
          id: c.id,
          name: c.workerName,
          remote: c.remote,
          connectedAt: c.connectedAt,
          sessionSec: Math.floor((now - c.connectedAt) / 1000),
          acceptedShares: c.acceptedShares,
          rejectedShares: c.rejectedShares,
          difficulty: c.difficultyNumber,
          lastShareAt: c.lastAcceptedShareAt || 0,
          avgShareIntervalMs: c.avgAcceptedShareIntervalMs || 0,
          userAgent: c.userAgent || ""
        });
      }
    }

    return {
      connected: this.clients.size,
      authorized,
      subscribed,
      workers
    };
  }

  handleConnection(socket) {
    const remoteAddress = socket.remoteAddress || "unknown";
    const ip = remoteAddress.replace(/^::ffff:/, ""); // Strip IPv6 prefix

    // Check max total clients
    if (this.clients.size >= this.config.maxClients) {
      this.logger.warn("Connection rejected: max clients reached", {
        ip,
        currentClients: this.clients.size,
        maxClients: this.config.maxClients
      });
      socket.destroy();
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(ip)) {
      this.logger.warn("Connection rejected: rate limit exceeded", {
        ip,
        rateLimitPerMin: this.config.connectionRateLimitPerMin
      });
      socket.destroy();
      return;
    }

    // Check max clients per IP
    const ipClients = this.connectionsByIp.get(ip) || new Set();
    if (ipClients.size >= this.config.maxClientsPerIp) {
      this.logger.warn("Connection rejected: max clients per IP", {
        ip,
        currentClientsForIp: ipClients.size,
        maxClientsPerIp: this.config.maxClientsPerIp
      });
      socket.destroy();
      return;
    }

    const clientId = ++this.clientSeq;
    const defaultWorker = `worker-${clientId}`;
    const client = {
      id: clientId,
      socket,
      buffer: EMPTY_BUFFER,
      connectedAt: nowMs(),
      subscribed: false,
      authorized: false,
      userAgent: "",
      workerName: defaultWorker,
      workerAddress: defaultWorker,
      workerFull: defaultWorker,
      difficulty: "",
      difficultyNumber: 0,
      shareTarget: 0n,
      pendingDifficulty: null,
      pendingDifficultyNumber: 0,
      pendingShareTarget: 0n,
      difficultySent: null,
      extranonce1Hex: this.allocateExtranonce1(),
      extranonce1Raw: null,
      remote: `${socket.remoteAddress || "?"}:${socket.remotePort || 0}`,
      acceptedShares: 0,
      rejectedShares: 0,
      lowDiffStreak: 0,
      prevhashMode: this.config.stratumPrevhashMode,
      prevhashModeSwitches: 0,
      versionRollingEnabled: false,
      versionRollingMaskHex: "00000000",
      lastAcceptedShareAt: 0,
      avgAcceptedShareIntervalMs: null,
      lastVarDiffRetargetAt: 0
    };
    client.extranonce1Raw = Buffer.from(client.extranonce1Hex, "hex");
    this.setClientDifficulty(client, this.config.baseDifficulty, { resetSent: false });

    this.clients.set(clientId, client);
    this.stats.connectionsTotal += 1;

    // Track connection by IP
    if (!this.connectionsByIp.has(ip)) {
      this.connectionsByIp.set(ip, new Set());
    }
    this.connectionsByIp.get(ip).add(clientId);

    this.logger.info("Miner connected", {
      clientId,
      remote: client.remote,
      connectedClients: this.clients.size,
      clientsFromIp: this.connectionsByIp.get(ip).size
    });

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 15000);
    socket.setTimeout(this.config.socketIdleTimeoutMs);

    socket.on("timeout", () => {
      this.logger.warn("Miner socket timeout", {
        clientId,
        remote: client.remote,
        idleTimeoutMs: this.config.socketIdleTimeoutMs
      });
      socket.destroy();
    });
    socket.on("error", (err) => {
      this.logger.debug("Client socket error", { clientId, error: err.message });
    });
    socket.on("close", () => {
      this.clients.delete(clientId);

      // Remove from IP tracking
      const ipSet = this.connectionsByIp.get(ip);
      if (ipSet) {
        ipSet.delete(clientId);
        if (ipSet.size === 0) {
          this.connectionsByIp.delete(ip);
        }
      }

      this.logger.info("Miner disconnected", {
        clientId,
        remote: client.remote,
        worker: client.workerName,
        subscribed: client.subscribed,
        authorized: client.authorized,
        acceptedShares: client.acceptedShares,
        rejectedShares: client.rejectedShares,
        sessionSec: Math.floor((nowMs() - client.connectedAt) / 1000),
        connectedClients: this.clients.size
      });
    });
    socket.on("data", (chunk) => this.handleData(client, chunk));
  }

  handleData(client, chunk) {
    const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
    const buf = client.buffer.length > 0
      ? Buffer.concat([client.buffer, incoming])
      : incoming;

    let lineStart = 0;
    for (let i = 0; i < buf.length; i += 1) {
      if (buf[i] !== 0x0a) continue;

      let lineEnd = i;
      if (lineEnd > lineStart && buf[lineEnd - 1] === 0x0d) {
        lineEnd -= 1;
      }

      const lineBuf = buf.subarray(lineStart, lineEnd);
      lineStart = i + 1;

      if (lineBuf.length === 0) continue;
      if (lineBuf.length > 16384) {
        this.logger.warn("Miner sent oversized line", {
          clientId: client.id,
          remote: client.remote,
          bytes: lineBuf.length
        });
        client.socket.destroy();
        return;
      }

      const parsed = safeJsonParse(lineBuf.toString("utf8"));
      if (!parsed.ok) {
        this.logger.warn("Miner sent invalid JSON", {
          clientId: client.id,
          remote: client.remote
        });
        this.send(client, { id: null, result: null, error: [20, "Bad JSON", null] });
        continue;
      }
      this.handleMessage(client, parsed.value);
    }

    if (lineStart >= buf.length) {
      client.buffer = EMPTY_BUFFER;
      return;
    }

    const remainderLen = buf.length - lineStart;
    if (remainderLen > 16384) {
      this.logger.warn("Miner sent oversized partial line", {
        clientId: client.id,
        remote: client.remote,
        bytes: remainderLen
      });
      client.socket.destroy();
      return;
    }
    client.buffer = Buffer.from(buf.subarray(lineStart));
  }

  async handleMessage(client, msg) {
    if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
      this.send(client, { id: msg && msg.id ? msg.id : null, result: null, error: [20, "Malformed request", null] });
      return;
    }

    const params = Array.isArray(msg.params) ? msg.params : [];
    try {
      switch (msg.method) {
        case "mining.subscribe":
          this.handleSubscribe(client, msg.id, params);
          return;
        case "mining.authorize":
          this.handleAuthorize(client, msg.id, params);
          return;
        case "mining.submit":
          await this.handleSubmit(client, msg.id, params);
          return;
        case "mining.extranonce.subscribe":
          this.send(client, { id: msg.id, result: true, error: null });
          return;
        case "mining.configure":
          this.handleConfigure(client, msg.id, params);
          return;
        case "mining.suggest_difficulty":
          if (params[0]) {
            this.setClientDifficulty(client, params[0]);
            this.pushDifficulty(client, true);
          }
          this.send(client, { id: msg.id, result: true, error: null });
          return;
        default:
          this.send(client, { id: msg.id, result: null, error: [20, `Unknown method ${msg.method}`, null] });
      }
    } catch (err) {
      this.logger.warn("Stratum request failed", {
        clientId: client.id,
        method: msg.method,
        error: err.message
      });
      this.send(client, { id: msg.id, result: null, error: [20, err.message, null] });
    }
  }

  handleSubscribe(client, id, params) {
    client.subscribed = true;
    client.userAgent = params[0] ? String(params[0]) : client.userAgent;
    this.logger.info("Miner subscribed", {
      clientId: client.id,
      remote: client.remote,
      userAgent: client.userAgent || null,
      extranonce1: client.extranonce1Hex,
      extranonce2Size: this.config.extranonce2Size
    });

    const subId = `${client.id.toString(16)}${Date.now().toString(16)}`;
    this.withCork(client, () => {
      this.send(client, {
        id,
        result: [
          [
            ["mining.set_difficulty", subId],
            ["mining.notify", subId]
          ],
          client.extranonce1Hex,
          this.config.extranonce2Size
        ],
        error: null
      });

      this.pushDifficulty(client, true);
      if (client.authorized && this.jobManager.currentJobSnapshot()) {
        this.pushJob(client, this.jobManager.currentJobSnapshot());
      }
    });
  }

  handleAuthorize(client, id, params) {
    const fullWorker = params[0] ? String(params[0]) : client.workerFull;
    const password = params[1] ? String(params[1]) : "";
    const kv = parsePasswordKv(password);

    // Parse address.workername format (standard pool convention)
    // e.g., "DGBAddress123.bitaxe1" -> address: "DGBAddress123", worker: "bitaxe1"
    // If no dot is found, use the full string for both address and worker name
    let workerAddress = fullWorker;
    let workerName = fullWorker;
    const dotIndex = fullWorker.indexOf('.');
    if (dotIndex > 0 && dotIndex < fullWorker.length - 1) {
      workerAddress = fullWorker.substring(0, dotIndex);
      workerName = fullWorker.substring(dotIndex + 1);
    }

    if (!this.config.allowAnyUser) {
      const token = kv.token || kv.auth || "";
      if (!this.config.minerAuthToken || token !== this.config.minerAuthToken) {
        this.logger.warn("Miner authorization failed", {
          clientId: client.id,
          remote: client.remote,
          worker: fullWorker
        });
        this.send(client, { id, result: false, error: STRATUM_ERRORS.unauthorized });
        return;
      }
    } else if (this.config.minerAuthToken) {
      const token = kv.token || kv.auth || "";
      if (token !== this.config.minerAuthToken) {
        this.logger.warn("Miner authorization failed", {
          clientId: client.id,
          remote: client.remote,
          worker: fullWorker
        });
        this.send(client, { id, result: false, error: STRATUM_ERRORS.unauthorized });
        return;
      }
    }

    client.authorized = true;
    client.workerAddress = workerAddress; // e.g., "DGBAddress123"
    client.workerName = workerName;       // e.g., "bitaxe1"
    client.workerFull = fullWorker;       // e.g., "DGBAddress123.bitaxe1"
    if (kv.d) {
      this.setClientDifficulty(client, kv.d);
    }

    this.logger.info("Miner authorized", {
      clientId: client.id,
      remote: client.remote,
      workerFull: client.workerFull,
      workerName: client.workerName,
      workerAddress: client.workerAddress,
      difficulty: client.difficultyNumber,
      prevhashMode: client.prevhashMode
    });

    this.withCork(client, () => {
      this.send(client, { id, result: true, error: null });
      this.pushDifficulty(client, true);
      if (client.subscribed && this.jobManager.currentJobSnapshot()) {
        this.pushJob(client, this.jobManager.currentJobSnapshot());
      }
    });
  }

  async handleSubmit(client, id, params) {
    if (!client.subscribed) {
      this.send(client, { id, result: null, error: STRATUM_ERRORS.notsubscribed });
      return;
    }
    if (!client.authorized) {
      this.send(client, { id, result: null, error: STRATUM_ERRORS.unauthorized });
      return;
    }
    if (params.length < 5) {
      this.send(client, { id, result: null, error: STRATUM_ERRORS.invalid });
      return;
    }

    const [workerName, jobId, extranonce2Hex, ntimeHex, nonceHex, versionBitsHex] = params;
    this.logSubmitExtras(client, params);
    const share = this.jobManager.validateShareSubmission({
      client,
      workerName: String(workerName || client.workerName),
      jobId: String(jobId),
      extranonce2Hex,
      ntimeHex,
      nonceHex,
      versionBitsHex
    });

    if (!share.ok) {
      client.rejectedShares += 1;
      if (share.code === "lowdiff") {
        client.lowDiffStreak += 1;
      }
      this.recordRejectedShare(share.code);
      this.recordShareSample("rejected", share, client);
      this.logRejectedShare(client, share, jobId);
      this.maybeDownshiftDifficulty(client, share);
      this.maybeRotatePrevhashMode(client, share);
      this.send(client, {
        id,
        result: null,
        error: STRATUM_ERRORS[share.code] || [20, share.message, null]
      });
      return;
    }

    const acceptedAt = nowMs();
    this.stats.sharesAccepted += 1;
    this.stats.lastShareAt = acceptedAt;
    this.stats.lastShareWorker = client.workerName;

    // Track best share difficulty
    const shareDiff = Number(share.shareDifficulty || 0);
    if (shareDiff > 0 && shareDiff > this.stats.bestShareDifficulty) {
      this.stats.bestShareDifficulty = shareDiff;
      this.stats.bestShareWorker = client.workerName;
      this.stats.bestShareAt = acceptedAt;
    }

    client.acceptedShares += 1;
    client.lowDiffStreak = 0;
    this.recordShareSample("accepted", share, client);
    this.recordAcceptedShareTiming(client, acceptedAt);
    this.logAcceptedShare(client, share);

    this.send(client, { id, result: true, error: null });
    this.jobManager.maybePrewarmBlockCandidatePayload?.(share);

    if (share.isBlockCandidate) {
      const blockResult = await this.jobManager.submitBlockCandidate(share, client);
      if (!blockResult.accepted) {
        this.logger.warn("Block candidate failed after share accepted", {
          worker: client.workerName,
          blockHash: blockResult.blockHash,
          reason: blockResult.nodeResult
        });
      }
    }

    this.maybeRetargetDifficulty(client, share, acceptedAt);
  }

  recordRejectedShare(code) {
    this.stats.sharesRejected += 1;
    if (code === "stale") this.stats.sharesStale += 1;
    if (code === "duplicate") this.stats.sharesDuplicate += 1;
    if (code === "lowdiff") this.stats.sharesLowDiff += 1;
  }

  recordAcceptedShareTiming(client, acceptedAt) {
    const prevAt = Number(client.lastAcceptedShareAt || 0);
    client.lastAcceptedShareAt = acceptedAt;
    if (prevAt <= 0) return;

    const deltaMs = Math.max(1, acceptedAt - prevAt);
    const prevAvg = Number(client.avgAcceptedShareIntervalMs);
    if (Number.isFinite(prevAvg) && prevAvg > 0) {
      // EMA keeps vardiff stable while still reacting to rate changes.
      client.avgAcceptedShareIntervalMs = Math.round((prevAvg * 0.7) + (deltaMs * 0.3));
    } else {
      client.avgAcceptedShareIntervalMs = deltaMs;
    }
  }

  recordShareSample(type, share, client) {
    if (!Array.isArray(this.stats.recentShares)) {
      this.stats.recentShares = [];
    }

    const shareDifficulty = Number(share && share.shareDifficulty ? share.shareDifficulty : 0);
    const assignedDifficulty = Number(
      share && share.assignedDifficulty
        ? share.assignedDifficulty
        : (client && client.difficultyNumber ? client.difficultyNumber : client && client.difficulty ? client.difficulty : 0)
    );
    const difficulty = (Number.isFinite(shareDifficulty) && shareDifficulty > 0)
      ? shareDifficulty
      : ((Number.isFinite(assignedDifficulty) && assignedDifficulty > 0) ? assignedDifficulty : 0);
    this.stats.recentShares.push({
      t: nowMs(),
      type: type === "rejected" ? "rejected" : "accepted",
      difficulty: Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 0,
      worker: client && client.workerName ? client.workerName : "",
      reason: share && share.code ? String(share.code) : null
    });

    const overflow = this.stats.recentShares.length - MAX_RECENT_SHARE_SAMPLES;
    if (overflow > 0) {
      this.stats.recentShares.splice(0, overflow);
    }
  }

  setClientDifficulty(client, nextDifficulty, options) {
    const opts = options || {};
    const state = this.normalizeDifficultyState(nextDifficulty);
    client.difficulty = state.difficulty;
    client.difficultyNumber = state.difficultyNumber;
    client.shareTarget = state.shareTarget;
    if (opts.resetSent !== false) {
      client.difficultySent = null;
    }
  }

  queueClientDifficulty(client, nextDifficulty) {
    const state = this.normalizeDifficultyState(nextDifficulty);
    client.pendingDifficulty = state.difficulty;
    client.pendingDifficultyNumber = state.difficultyNumber;
    client.pendingShareTarget = state.shareTarget;
  }

  applyPendingDifficulty(client) {
    if (!client.pendingDifficulty) return false;
    client.difficulty = client.pendingDifficulty;
    client.difficultyNumber = client.pendingDifficultyNumber;
    client.shareTarget = client.pendingShareTarget;
    client.pendingDifficulty = null;
    client.pendingDifficultyNumber = 0;
    client.pendingShareTarget = 0n;
    client.difficultySent = null;
    return true;
  }

  normalizeDifficultyState(nextDifficulty) {
    const difficulty = String(nextDifficulty).trim();
    const shareTarget = this.jobManager.getShareTargetForDifficulty(difficulty);
    const difficultyNumber = Number(difficulty);
    if (!Number.isFinite(difficultyNumber) || difficultyNumber <= 0) {
      throw new Error("difficulty must be > 0");
    }
    return { difficulty, difficultyNumber, shareTarget };
  }

  maybeRetargetDifficulty(client, share, now) {
    if (!this.config.enableVarDiff) return;
    if (client.acceptedShares < 2) return;

    const every = Math.max(1, Number(this.config.varDiffRetargetEveryShares || 4));
    if (client.acceptedShares % every !== 0) return;

    const avgMs = Number(client.avgAcceptedShareIntervalMs);
    if (!Number.isFinite(avgMs) || avgMs <= 0) return;

    const currentDiff = Number(
      client.pendingDifficultyNumber || client.difficultyNumber || client.difficulty
    );
    const minDiff = Math.max(1, Number(this.config.minDifficulty || 1));
    const maxDiff = Math.max(
      minDiff,
      Number.isFinite(Number(this.config.varDiffMaxDifficulty))
        ? Number(this.config.varDiffMaxDifficulty)
        : Number(this.config.baseDifficulty || minDiff)
    );
    if (!Number.isFinite(currentDiff) || currentDiff <= 0) return;

    const targetMs = Math.max(1000, Number(this.config.varDiffTargetShareTimeMs || 15000));
    let factor = 1;
    if (avgMs < targetMs * 0.25) factor = 4;
    else if (avgMs < targetMs * 0.5) factor = 2;
    else if (avgMs > targetMs * 4) factor = 0.25;
    else if (avgMs > targetMs * 2) factor = 0.5;
    else return;

    let nextDiff = Math.floor(currentDiff * factor);
    nextDiff = Math.max(minDiff, Math.min(maxDiff, nextDiff));
    if (nextDiff === Math.floor(currentDiff)) return;

    this.queueClientDifficulty(client, nextDiff);
    client.lastVarDiffRetargetAt = now;

    this.logger.info("Retargeted miner difficulty", {
      clientId: client.id,
      remote: client.remote,
      worker: client.workerName,
      previousDifficulty: currentDiff,
      newDifficulty: nextDiff,
      avgShareIntervalMs: avgMs,
      targetShareIntervalMs: targetMs,
      shareDifficulty: Number(share.shareDifficulty || 0),
      applyOn: "next_job"
    });
  }

  handleConfigure(client, id, params) {
    this.logConfigureRequest(client, params);

    const extensions = Array.isArray(params[0]) ? params[0].map(String) : [];
    const options = (params[1] && typeof params[1] === "object") ? params[1] : {};
    const result = {};

    if (extensions.includes("version-rolling")) {
      const negotiatedMaskHex = negotiateVersionRollingMask(
        options["version-rolling.mask"],
        SERVER_VERSION_ROLLING_MASK_HEX
      );
      client.versionRollingMaskHex = negotiatedMaskHex;
      client.versionRollingEnabled = negotiatedMaskHex !== "00000000";
      result["version-rolling"] = client.versionRollingEnabled;
      result["version-rolling.mask"] = negotiatedMaskHex;
    }

    this.send(client, { id, result, error: null });
  }

  logConfigureRequest(client, params) {
    if (!this.config.debugShareValidation) return;
    const extensions = Array.isArray(params[0]) ? params[0] : [];
    const options = (params[1] && typeof params[1] === "object") ? params[1] : {};
    this.logger.info("Miner configure request", {
      clientId: client.id,
      remote: client.remote,
      extensions,
      options
    });
  }

  logSubmitExtras(client, params) {
    if (!this.config.debugShareValidation) return;
    if (params.length <= 5) return;
    client.debugSubmitExtraLogs = (client.debugSubmitExtraLogs || 0) + 1;
    const n = client.debugSubmitExtraLogs;
    if (!(n <= 10 || n % 50 === 0)) return;
    this.logger.warn("Miner submit includes extra params", {
      clientId: client.id,
      remote: client.remote,
      versionRollingEnabled: client.versionRollingEnabled,
      versionRollingMask: client.versionRollingMaskHex,
      extraParamCount: params.length - 5,
      extraParams: params.slice(5).map((v) => String(v))
    });
  }

  allocateExtranonce1() {
    this.extranonceCounter += 1n;
    const bytes = this.config.extranonce1Size;
    let x = this.extranonceCounter;
    const buf = Buffer.alloc(bytes);
    for (let i = bytes - 1; i >= 0; i -= 1) {
      buf[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return buf.toString("hex");
  }

  pushDifficulty(client, force) {
    if (!client.subscribed) return;
    if (!force && client.difficultySent === client.difficulty) return;
    client.difficultySent = client.difficulty;
    this.send(client, {
      id: null,
      method: "mining.set_difficulty",
      params: [Number.isFinite(client.difficultyNumber) ? client.difficultyNumber : Number(client.difficulty)]
    });
  }

  pushJob(client, job, options) {
    if (!client.subscribed) return;
    const cleanJobs = options && Object.prototype.hasOwnProperty.call(options, "cleanJobs")
      ? Boolean(options.cleanJobs)
      : Boolean(job.cleanJobs);
    const prevhashMode = client.prevhashMode || this.config.stratumPrevhashMode;
    const cleanKey = cleanJobs ? "1" : "0";
    const prebuiltLine = job.notifyLinesByMode
      && job.notifyLinesByMode[prevhashMode]
      && job.notifyLinesByMode[prevhashMode][cleanKey];
    if (prebuiltLine) {
      this.sendLine(client, prebuiltLine);
      return;
    }
    const prevhashNotifyHex = (job.prevhashNotifyHexByMode && job.prevhashNotifyHexByMode[prevhashMode])
      || formatPrevhashForStratum(job.prevhashRpcHex, prevhashMode);
    this.send(client, buildNotifyPayload(job, prevhashNotifyHex, cleanJobs));
  }

  broadcastJob(job) {
    let pushed = 0;
    for (const client of this.clients.values()) {
      if (!client.subscribed || !client.authorized) continue;
      this.applyPendingDifficulty(client);
      this.withCork(client, () => {
        this.pushDifficulty(client, false);
        this.pushJob(client, job);
      });
      pushed += 1;
    }
    this.stats.jobBroadcasts += 1;
    this.stats.lastBroadcastAt = Date.now();
    this.stats.lastBroadcastClients = pushed;
    if (pushed > 0) {
      this.logger.info("Broadcasted job to miners", {
        jobId: job.jobId,
        height: job.template.height,
        clients: pushed,
        cleanJobs: Boolean(job.cleanJobs)
      });
    }
  }

  send(client, payload) {
    this.sendLine(client, JSON.stringify(payload) + "\n");
  }

  sendLine(client, line) {
    if (client.socket.destroyed) return;
    const ok = client.socket.write(line);
    if (!ok) {
      // Backpressure on a mining socket is almost always a slow/broken client.
      client.socket.destroy();
    }
  }

  withCork(client, fn) {
    const socket = client.socket;
    if (!socket || socket.destroyed) return;
    if (typeof socket.cork !== "function" || typeof socket.uncork !== "function") {
      fn();
      return;
    }
    socket.cork();
    try {
      fn();
    } finally {
      socket.uncork();
    }
  }

  logAcceptedShare(client, share) {
    const n = client.acceptedShares;
    const fields = {
      clientId: client.id,
      remote: client.remote,
      worker: client.workerName,
      sharesAccepted: n,
      jobId: share.job.jobId,
      difficulty: Number(share.assignedDifficulty || client.difficulty),
      shareDifficulty: Number(share.shareDifficulty || 0),
      blockCandidate: Boolean(share.isBlockCandidate),
      shareHash: share.shareHashHex
    };

    if (n <= 3 || n % 25 === 0 || share.isBlockCandidate) {
      this.logger.info("Share accepted", fields);
    } else {
      this.logger.debug("Share accepted", fields);
    }
  }

  logRejectedShare(client, share, jobId) {
    // Skip logging stale shares - they're normal during block transitions
    if (share.code === "stale") return;
    // Skip logging lowdiff shares - they're normal during difficulty adjustment
    if (share.code === "lowdiff") return;

    const n = client.rejectedShares;
    const fields = {
      clientId: client.id,
      remote: client.remote,
      worker: client.workerName,
      sharesRejected: n,
      jobId: String(jobId),
      reasonCode: share.code,
      reason: share.message
    };
    if (share.shareDifficulty !== undefined) {
      fields.shareDifficulty = String(share.shareDifficulty);
    }
    if (share.shareHashHex) {
      fields.shareHash = share.shareHashHex;
    }

    if (n <= 5 || n % 25 === 0) {
      this.logger.warn("Share rejected", fields);
    } else {
      this.logger.debug("Share rejected", fields);
    }
  }

  maybeDownshiftDifficulty(client, share) {
    if (share.code !== "lowdiff") return;
    if (client.acceptedShares > 0) return;

    const currentDiff = Number(client.difficultyNumber || client.difficulty);
    const minDiff = Number(this.config.minDifficulty || 1);
    if (!Number.isFinite(currentDiff) || !Number.isFinite(minDiff)) return;
    if (currentDiff <= minDiff) return;

    // If a new miner repeatedly submits lowdiff shares, the startup diff is too high.
    // Downshift aggressively so we can confirm compatibility quickly.
    if (client.lowDiffStreak < 10 || client.lowDiffStreak % 10 !== 0) return;

    let nextDiff = Math.floor(currentDiff / 4);
    const observedShareDiff = Number(share.shareDifficulty || 0);
    if (Number.isFinite(observedShareDiff) && observedShareDiff > 0) {
      // Aim somewhat above the observed share diff so we accept regularly without flooding.
      const observedTarget = Math.max(1, Math.floor(observedShareDiff * 2));
      nextDiff = Math.min(nextDiff, observedTarget);
    }
    nextDiff = Math.max(Math.floor(minDiff), nextDiff);

    if (nextDiff >= currentDiff) return;

    this.setClientDifficulty(client, nextDiff);
    client.lowDiffStreak = 0;

    this.logger.info("Auto-lowered miner difficulty", {
      clientId: client.id,
      remote: client.remote,
      worker: client.workerName,
      previousDifficulty: currentDiff,
      newDifficulty: nextDiff,
      minDifficulty: minDiff
    });

    const job = this.jobManager.currentJobSnapshot();
    this.withCork(client, () => {
      this.pushDifficulty(client, true);
      if (job) {
        this.pushJob(client, job, { cleanJobs: true });
      }
    });
  }

  maybeRotatePrevhashMode(client, share) {
    if (share.code !== "lowdiff") return;
    if (client.acceptedShares > 0) return;
    const rotateEvery = this.config.debugShareValidation ? 10 : 40;
    if (client.lowDiffStreak < rotateEvery || client.lowDiffStreak % rotateEvery !== 0) return;

    const modes = ["stratum", "stratum_wordrev", "header", "rpc"];
    const currentIndex = Math.max(0, modes.indexOf(client.prevhashMode));
    const nextMode = modes[(currentIndex + 1) % modes.length];
    if (nextMode === client.prevhashMode) return;

    client.prevhashMode = nextMode;
    client.prevhashModeSwitches += 1;

    this.logger.warn("Switched miner prevhash mode after persistent lowdiff shares", {
      clientId: client.id,
      remote: client.remote,
      worker: client.workerName,
      prevhashMode: client.prevhashMode,
      switches: client.prevhashModeSwitches,
      lowDiffStreak: client.lowDiffStreak
    });

    const job = this.jobManager.currentJobSnapshot();
    if (job) {
      this.pushJob(client, job, { cleanJobs: true });
    }
  }

  checkRateLimit(ip) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Get or create connection attempts array for this IP
    if (!this.connectionAttempts.has(ip)) {
      this.connectionAttempts.set(ip, []);
    }

    const attempts = this.connectionAttempts.get(ip);

    // Remove old attempts (older than 1 minute)
    while (attempts.length > 0 && attempts[0] < oneMinuteAgo) {
      attempts.shift();
    }

    // Check if limit exceeded
    if (attempts.length >= this.config.connectionRateLimitPerMin) {
      return false;
    }

    // Record this attempt
    attempts.push(now);
    return true;
  }

  cleanupRateLimitTracking() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    let cleanedCount = 0;

    for (const [ip, attempts] of this.connectionAttempts.entries()) {
      // Remove old attempts
      while (attempts.length > 0 && attempts[0] < oneMinuteAgo) {
        attempts.shift();
      }

      // Remove IP entry if no recent attempts
      if (attempts.length === 0) {
        this.connectionAttempts.delete(ip);
        cleanedCount += 1;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug("Cleaned up rate limit tracking", {
        cleanedIps: cleanedCount,
        trackedIps: this.connectionAttempts.size
      });
    }
  }
}

function negotiateVersionRollingMask(requestedMaskValue, serverMaskHex) {
  const serverMask = parseHexU32(serverMaskHex);
  if (serverMask === null) return "00000000";
  const requestedMask = requestedMaskValue === undefined || requestedMaskValue === null || requestedMaskValue === ""
    ? 0xffffffff
    : parseHexU32(String(requestedMaskValue));
  if (requestedMask === null) {
    return "00000000";
  }
  return toFixedHexU32((requestedMask & serverMask) >>> 0);
}

function parseHexU32(value) {
  try {
    const hex = normalizeHex(String(value)).padStart(8, "0");
    if (hex.length !== 8) return null;
    return Number.parseInt(hex, 16) >>> 0;
  } catch {
    return null;
  }
}

function buildNotifyPayload(job, prevhashNotifyHex, cleanJobs) {
  return {
    id: null,
    method: "mining.notify",
    params: [
      job.jobId,
      prevhashNotifyHex,
      job.coinbase1Hex,
      job.coinbase2Hex,
      job.merkleBranchesHex,
      job.versionHex,
      job.bitsHex,
      job.ntimeHex,
      cleanJobs
    ]
  };
}

module.exports = { StratumServer };
