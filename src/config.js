"use strict";

const {
  toBool,
  toInt,
  toFloat,
  splitRulesCsv
} = require("./utils");

function loadConfig() {
  const cfg = {
    nodeRpcHost: process.env.NODE_RPC_HOST || "127.0.0.1",
    nodeRpcPort: toInt(process.env.NODE_RPC_PORT, 14022),
    nodeRpcUser: process.env.NODE_RPC_USER || "",
    nodeRpcPass: process.env.NODE_RPC_PASS || "",
    nodeRpcTls: toBool(process.env.NODE_RPC_TLS, false),
    nodeRpcTimeoutMs: toInt(process.env.NODE_RPC_TIMEOUT_MS, 5000),
    nodeRpcLongpollTimeoutMs: toInt(process.env.NODE_RPC_LONGPOLL_TIMEOUT_MS, 90000),
    allowNodePowAlgoMismatch: toBool(process.env.ALLOW_NODE_POW_ALGO_MISMATCH, false),

    stratumHost: process.env.STRATUM_HOST || "0.0.0.0",
    stratumPort: toInt(process.env.STRATUM_PORT, 3333),
    stratumPrevhashMode: process.env.STRATUM_PREVHASH_MODE || "stratum",
    socketIdleTimeoutMs: toInt(process.env.SOCKET_IDLE_TIMEOUT_MS, 300000),
    maxClients: toInt(process.env.MAX_CLIENTS, 1000),
    maxClientsPerIp: toInt(process.env.MAX_CLIENTS_PER_IP, 10),
    connectionRateLimitPerMin: toInt(process.env.CONNECTION_RATE_LIMIT_PER_MIN, 60),

    apiHost: process.env.API_HOST || "0.0.0.0",
    apiPort: toInt(process.env.API_PORT, 8080),
    apiTls: toBool(process.env.API_TLS, false),
    apiTlsCert: process.env.API_TLS_CERT || "",
    apiTlsKey: process.env.API_TLS_KEY || "",
    apiCorsEnabled: toBool(process.env.API_CORS_ENABLED, true),
    apiCorsOrigin: process.env.API_CORS_ORIGIN || "*",

    powAlgo: (process.env.POW_ALGO || "sha256d").toLowerCase(),
    baseDifficulty: String(process.env.BASE_DIFFICULTY || "16384"),
    minDifficulty: String(process.env.MIN_DIFFICULTY || "1"),
    enableVarDiff: toBool(process.env.ENABLE_VARDIFF, true),
    varDiffTargetShareTimeMs: toInt(process.env.VARDIFF_TARGET_SHARE_TIME_MS, 15000),
    varDiffRetargetEveryShares: toInt(process.env.VARDIFF_RETARGET_EVERY_SHARES, 4),
    varDiffMaxDifficulty: String(process.env.VARDIFF_MAX_DIFFICULTY || process.env.BASE_DIFFICULTY || "16384"),
    enableNearCandidatePrewarm: toBool(process.env.ENABLE_NEAR_CANDIDATE_PREWARM, true),
    nearCandidatePrewarmFactor: toInt(process.env.NEAR_CANDIDATE_PREWARM_FACTOR, 256),
    extranonce1Size: toInt(process.env.EXTRANONCE1_SIZE, 4),
    extranonce2Size: toInt(process.env.EXTRANONCE2_SIZE, 8),

    poolPayoutAddress: process.env.POOL_PAYOUT_ADDRESS || "",
    poolPayoutScriptHex: process.env.POOL_PAYOUT_SCRIPT_HEX || "",
    poolTag: process.env.POOL_TAG || "/gbf-solo/",

    allowAnyUser: toBool(process.env.ALLOW_ANY_USER, true),
    minerAuthToken: process.env.MINER_AUTH_TOKEN || "",

    enableLongpoll: toBool(process.env.ENABLE_LONGPOLL, true),
    templatePollMs: toInt(process.env.TEMPLATE_POLL_MS, 1000),
    templatePollMsLongpollHealthy: toInt(process.env.TEMPLATE_POLL_MS_LONGPOLL_HEALTHY, 5000),
    longpollHealthyGraceMs: toInt(process.env.LONGPOLL_HEALTHY_GRACE_MS, 120000),
    templateFingerprintMode: (process.env.TEMPLATE_FINGERPRINT_MODE || "fast").toLowerCase(),
    keepOldJobs: toInt(process.env.KEEP_OLD_JOBS, 8),
    maxJobSubmissionsTracked: toInt(process.env.MAX_JOB_SUBMISSIONS_TRACKED, 50000),
    gbtRules: splitRulesCsv(process.env.GBT_RULES || "segwit"),

    debugShareValidation: toBool(process.env.DEBUG_SHARE_VALIDATION, false),
    logLevel: process.env.LOG_LEVEL || "info"
  };

  if (!cfg.nodeRpcUser || !cfg.nodeRpcPass) {
    throw new Error("NODE_RPC_USER and NODE_RPC_PASS are required");
  }
  if (!cfg.poolPayoutAddress && !cfg.poolPayoutScriptHex) {
    throw new Error("POOL_PAYOUT_ADDRESS or POOL_PAYOUT_SCRIPT_HEX is required");
  }
  if (cfg.extranonce1Size < 2 || cfg.extranonce1Size > 16) {
    throw new Error("EXTRANONCE1_SIZE must be between 2 and 16");
  }
  if (cfg.extranonce2Size < 2 || cfg.extranonce2Size > 16) {
    throw new Error("EXTRANONCE2_SIZE must be between 2 and 16");
  }
  if (cfg.varDiffTargetShareTimeMs < 1000) {
    throw new Error("VARDIFF_TARGET_SHARE_TIME_MS must be >= 1000");
  }
  if (cfg.varDiffRetargetEveryShares < 1) {
    throw new Error("VARDIFF_RETARGET_EVERY_SHARES must be >= 1");
  }
  if (cfg.nearCandidatePrewarmFactor < 2) {
    throw new Error("NEAR_CANDIDATE_PREWARM_FACTOR must be >= 2");
  }
  if (cfg.maxJobSubmissionsTracked < 1000) {
    throw new Error("MAX_JOB_SUBMISSIONS_TRACKED must be >= 1000");
  }
  if (cfg.templatePollMsLongpollHealthy < 250) {
    throw new Error("TEMPLATE_POLL_MS_LONGPOLL_HEALTHY must be >= 250");
  }
  if (cfg.longpollHealthyGraceMs < 1000) {
    throw new Error("LONGPOLL_HEALTHY_GRACE_MS must be >= 1000");
  }
  if (cfg.powAlgo !== "sha256d") {
    throw new Error("Only POW_ALGO=sha256d is currently supported");
  }
  if (!["stratum", "stratum_wordrev", "header", "rpc"].includes(cfg.stratumPrevhashMode)) {
    throw new Error("STRATUM_PREVHASH_MODE must be one of: stratum, stratum_wordrev, header, rpc");
  }
  if (!["full", "fast", "prevhash"].includes(cfg.templateFingerprintMode)) {
    throw new Error("TEMPLATE_FINGERPRINT_MODE must be one of: full, fast, prevhash");
  }
  if (cfg.apiTls && (!cfg.apiTlsCert || !cfg.apiTlsKey)) {
    throw new Error("API_TLS_CERT and API_TLS_KEY are required when API_TLS=true");
  }

  return Object.freeze(cfg);
}

module.exports = { loadConfig };
