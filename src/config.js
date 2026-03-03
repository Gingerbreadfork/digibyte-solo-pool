"use strict";

const {
  toBool,
  toInt,
  toFloat,
  splitRulesCsv,
  normalizeHex
} = require("./utils");

function loadConfig() {
  const nodeRpcHost = process.env.NODE_RPC_HOST || "127.0.0.1";
  const defaultZmqHashblockEndpoint = `tcp://${formatTcpEndpointHost(nodeRpcHost)}:28332`;
  const enableZmqHashblock = toBool(process.env.ENABLE_ZMQ_HASHBLOCK, true);
  const enableLongpollDefault = enableZmqHashblock ? false : true;

  const cfg = {
    nodeRpcHost,
    nodeRpcPort: toInt(process.env.NODE_RPC_PORT, 14022),
    nodeRpcUser: process.env.NODE_RPC_USER || "",
    nodeRpcPass: process.env.NODE_RPC_PASS || "",
    nodeRpcTls: toBool(process.env.NODE_RPC_TLS, false),
    nodeRpcTimeoutMs: toInt(process.env.NODE_RPC_TIMEOUT_MS, 5000),
    nodeRpcLongpollTimeoutMs: toInt(process.env.NODE_RPC_LONGPOLL_TIMEOUT_MS, 90000),
    allowNodePowAlgoMismatch: toBool(process.env.ALLOW_NODE_POW_ALGO_MISMATCH, false),
    enableZmqHashblock,
    zmqHashblockEndpoint: process.env.ZMQ_HASHBLOCK_ENDPOINT || defaultZmqHashblockEndpoint,
    zmqReconnectBaseMs: toInt(process.env.ZMQ_RECONNECT_BASE_MS, 250),
    zmqReconnectMaxMs: toInt(process.env.ZMQ_RECONNECT_MAX_MS, 10000),

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
    enableEntropyLamp: toBool(process.env.ENABLE_ENTROPY_LAMP, true),

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
    poolPayoutAddressExplorerBase: process.env.POOL_PAYOUT_ADDRESS_EXPLORER_BASE || "https://digiexplorer.info/address/",
    poolPayoutScriptHex: process.env.POOL_PAYOUT_SCRIPT_HEX || "",
    poolTag: process.env.POOL_TAG || "/gbf-solo/",

    allowAnyUser: toBool(process.env.ALLOW_ANY_USER, true),
    minerAuthToken: process.env.MINER_AUTH_TOKEN || "",
    versionRollingMaskHex: (process.env.VERSION_ROLLING_MASK || "1fffe000"),
    versionRollingMinBitCount: toInt(process.env.VERSION_ROLLING_MIN_BIT_COUNT, 1),
    enableVersionMaskSlicing: toBool(process.env.ENABLE_VERSION_MASK_SLICING, true),
    disableSlicingForNerdAxe: toBool(
      process.env.DISABLE_SLICING_FOR_NERDAXE !== undefined
        ? process.env.DISABLE_SLICING_FOR_NERDAXE
        : process.env.DISABLE_SLICING_FOR_NERDOCTAXE,
      true
    ),
    versionMaskSliceBitsPerMiner: toInt(process.env.VERSION_MASK_SLICE_BITS_PER_MINER, 2),
    versionMaskSliceFallbackRejects: toInt(process.env.VERSION_MASK_SLICE_FALLBACK_REJECTS, 8),
    enableEspMinerNotifyCoalescing: toBool(process.env.ENABLE_ESP_MINER_NOTIFY_COALESCING, true),
    espMinerNotifyNoncleanMinIntervalMs: toInt(process.env.ESP_MINER_NOTIFY_NONCLEAN_MIN_INTERVAL_MS, 3000),
    espMinerNotifyForceIntervalMs: toInt(process.env.ESP_MINER_NOTIFY_FORCE_INTERVAL_MS, 15000),
    enableAdaptiveNotifyPacing: toBool(process.env.ENABLE_ADAPTIVE_NOTIFY_PACING, true),
    adaptiveNotifyBaseIntervalMs: toInt(process.env.ADAPTIVE_NOTIFY_BASE_INTERVAL_MS, 400),
    adaptiveNotifyTargetShareMs: toInt(process.env.ADAPTIVE_NOTIFY_TARGET_SHARE_MS, 2000),
    adaptiveNotifyMaxIntervalMs: toInt(process.env.ADAPTIVE_NOTIFY_MAX_INTERVAL_MS, 5000),
    adaptiveNotifyHighAckMs: toInt(process.env.ADAPTIVE_NOTIFY_HIGH_ACK_MS, 200),
    adaptiveNotifyHighRejectRatioPct: toFloat(process.env.ADAPTIVE_NOTIFY_HIGH_REJECT_RATIO_PCT, 5),
    enableSetExtranonceOrchestration: toBool(process.env.ENABLE_SET_EXTRANONCE_ORCHESTRATION, true),
    setExtranonceRotateCooldownMs: toInt(process.env.SET_EXTRANONCE_ROTATE_COOLDOWN_MS, 10000),

    enableLongpoll: toBool(process.env.ENABLE_LONGPOLL, enableLongpollDefault),
    templatePollMs: toInt(process.env.TEMPLATE_POLL_MS, 1000),
    templatePollMsLongpollHealthy: toInt(process.env.TEMPLATE_POLL_MS_LONGPOLL_HEALTHY, 500),
    longpollHealthyGraceMs: toInt(process.env.LONGPOLL_HEALTHY_GRACE_MS, 120000),
    enableNewBlockFastpath: toBool(process.env.ENABLE_NEW_BLOCK_FASTPATH, true),
    newBlockFastpathTxLimit: toInt(process.env.NEW_BLOCK_FASTPATH_TX_LIMIT, 0),
    enableSpeculativeNextTemplatePrebuild: toBool(process.env.ENABLE_SPECULATIVE_NEXT_TEMPLATE_PREBUILD, true),
    enableProactiveNonceSpaceRefresh: toBool(process.env.ENABLE_PROACTIVE_NONCE_SPACE_REFRESH, true),
    nonceSpaceRefreshFastShareMs: toInt(process.env.NONCE_SPACE_REFRESH_FAST_SHARE_MS, 2000),
    nonceSpaceRefreshCooldownMs: toInt(process.env.NONCE_SPACE_REFRESH_COOLDOWN_MS, 8000),
    nonceSpaceRefreshDuplicateStreak: toInt(process.env.NONCE_SPACE_REFRESH_DUPLICATE_STREAK, 3),
    templateFingerprintMode: (process.env.TEMPLATE_FINGERPRINT_MODE || "fast").toLowerCase(),
    keepOldJobs: toInt(process.env.KEEP_OLD_JOBS, 8),
    maxJobSubmissionsTracked: toInt(process.env.MAX_JOB_SUBMISSIONS_TRACKED, 50000),
    gbtRules: splitRulesCsv(process.env.GBT_RULES || "segwit"),

    statsPersistenceEnabled: toBool(process.env.STATS_PERSISTENCE_ENABLED, true),
    statsPersistenceDir: process.env.STATS_PERSISTENCE_DIR || "data",
    statsWalCaptureMs: toInt(process.env.STATS_WAL_CAPTURE_MS, 1000),
    statsWalFlushMs: toInt(process.env.STATS_WAL_FLUSH_MS, 1000),
    statsCheckpointMs: toInt(process.env.STATS_CHECKPOINT_MS, 60000),
    statsRecentSharesMax: toInt(process.env.STATS_RECENT_SHARES_MAX, 240),
    blockStatusCheckMs: toInt(process.env.BLOCK_STATUS_CHECK_MS, 30000),

    debugShareValidation: toBool(process.env.DEBUG_SHARE_VALIDATION, false),
    logNewJobs: toBool(process.env.LOG_NEW_JOBS, false),
    logPoolStatsSnapshot: toBool(process.env.LOG_POOL_STATS_SNAPSHOT, false),
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
  cfg.versionRollingMaskHex = normalizeHex(String(cfg.versionRollingMaskHex || "")).padStart(8, "0");
  if (cfg.versionRollingMaskHex.length !== 8) {
    throw new Error("VERSION_ROLLING_MASK must be a 4-byte hex mask");
  }
  const versionRollingMaskBits = countSetBitsU32(Number.parseInt(cfg.versionRollingMaskHex, 16) >>> 0);
  if (cfg.versionRollingMinBitCount < 0 || cfg.versionRollingMinBitCount > 32) {
    throw new Error("VERSION_ROLLING_MIN_BIT_COUNT must be between 0 and 32");
  }
  if (cfg.versionRollingMinBitCount > versionRollingMaskBits) {
    throw new Error("VERSION_ROLLING_MIN_BIT_COUNT cannot exceed set bits in VERSION_ROLLING_MASK");
  }
  if (cfg.versionMaskSliceBitsPerMiner < 1 || cfg.versionMaskSliceBitsPerMiner > 16) {
    throw new Error("VERSION_MASK_SLICE_BITS_PER_MINER must be between 1 and 16");
  }
  if (cfg.versionMaskSliceFallbackRejects < 1 || cfg.versionMaskSliceFallbackRejects > 100) {
    throw new Error("VERSION_MASK_SLICE_FALLBACK_REJECTS must be between 1 and 100");
  }
  if (cfg.espMinerNotifyNoncleanMinIntervalMs < 0) {
    throw new Error("ESP_MINER_NOTIFY_NONCLEAN_MIN_INTERVAL_MS must be >= 0");
  }
  if (cfg.espMinerNotifyForceIntervalMs < 1000) {
    throw new Error("ESP_MINER_NOTIFY_FORCE_INTERVAL_MS must be >= 1000");
  }
  if (cfg.adaptiveNotifyBaseIntervalMs < 0) {
    throw new Error("ADAPTIVE_NOTIFY_BASE_INTERVAL_MS must be >= 0");
  }
  if (cfg.adaptiveNotifyTargetShareMs < 250) {
    throw new Error("ADAPTIVE_NOTIFY_TARGET_SHARE_MS must be >= 250");
  }
  if (cfg.adaptiveNotifyMaxIntervalMs < 250) {
    throw new Error("ADAPTIVE_NOTIFY_MAX_INTERVAL_MS must be >= 250");
  }
  if (cfg.adaptiveNotifyHighAckMs < 1) {
    throw new Error("ADAPTIVE_NOTIFY_HIGH_ACK_MS must be >= 1");
  }
  if (
    !Number.isFinite(cfg.adaptiveNotifyHighRejectRatioPct)
    || cfg.adaptiveNotifyHighRejectRatioPct < 0
    || cfg.adaptiveNotifyHighRejectRatioPct > 100
  ) {
    throw new Error("ADAPTIVE_NOTIFY_HIGH_REJECT_RATIO_PCT must be between 0 and 100");
  }
  if (cfg.setExtranonceRotateCooldownMs < 1000) {
    throw new Error("SET_EXTRANONCE_ROTATE_COOLDOWN_MS must be >= 1000");
  }
  if (cfg.nearCandidatePrewarmFactor < 2) {
    throw new Error("NEAR_CANDIDATE_PREWARM_FACTOR must be >= 2");
  }
  if (cfg.enableZmqHashblock && !String(cfg.zmqHashblockEndpoint || "").trim()) {
    throw new Error("ZMQ_HASHBLOCK_ENDPOINT is required when ENABLE_ZMQ_HASHBLOCK=true");
  }
  if (String(cfg.zmqHashblockEndpoint || "").trim()) {
    let endpoint;
    try {
      endpoint = new URL(String(cfg.zmqHashblockEndpoint).trim());
    } catch (err) {
      throw new Error("ZMQ_HASHBLOCK_ENDPOINT must be a valid URL (for example tcp://127.0.0.1:28332)");
    }
    if (endpoint.protocol !== "tcp:") {
      throw new Error("ZMQ_HASHBLOCK_ENDPOINT must use tcp://");
    }
    const zmqPort = Number(endpoint.port);
    if (!Number.isInteger(zmqPort) || zmqPort < 1 || zmqPort > 65535) {
      throw new Error("ZMQ_HASHBLOCK_ENDPOINT port must be between 1 and 65535");
    }
  }
  if (cfg.zmqReconnectBaseMs < 50) {
    throw new Error("ZMQ_RECONNECT_BASE_MS must be >= 50");
  }
  if (cfg.zmqReconnectMaxMs < cfg.zmqReconnectBaseMs) {
    throw new Error("ZMQ_RECONNECT_MAX_MS must be >= ZMQ_RECONNECT_BASE_MS");
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
  if (cfg.newBlockFastpathTxLimit < 0) {
    throw new Error("NEW_BLOCK_FASTPATH_TX_LIMIT must be >= 0");
  }
  if (cfg.newBlockFastpathTxLimit > 10000) {
    throw new Error("NEW_BLOCK_FASTPATH_TX_LIMIT must be <= 10000");
  }
  if (cfg.nonceSpaceRefreshFastShareMs < 250) {
    throw new Error("NONCE_SPACE_REFRESH_FAST_SHARE_MS must be >= 250");
  }
  if (cfg.nonceSpaceRefreshCooldownMs < 1000) {
    throw new Error("NONCE_SPACE_REFRESH_COOLDOWN_MS must be >= 1000");
  }
  if (cfg.nonceSpaceRefreshDuplicateStreak < 1) {
    throw new Error("NONCE_SPACE_REFRESH_DUPLICATE_STREAK must be >= 1");
  }
  if (cfg.statsWalCaptureMs < 250) {
    throw new Error("STATS_WAL_CAPTURE_MS must be >= 250");
  }
  if (cfg.statsWalFlushMs < 100) {
    throw new Error("STATS_WAL_FLUSH_MS must be >= 100");
  }
  if (cfg.statsCheckpointMs < 5000) {
    throw new Error("STATS_CHECKPOINT_MS must be >= 5000");
  }
  if (cfg.statsRecentSharesMax < 10) {
    throw new Error("STATS_RECENT_SHARES_MAX must be >= 10");
  }
  if (cfg.blockStatusCheckMs < 5000) {
    throw new Error("BLOCK_STATUS_CHECK_MS must be >= 5000");
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

function countSetBitsU32(value) {
  let v = value >>> 0;
  let count = 0;
  while (v) {
    v &= (v - 1) >>> 0;
    count += 1;
  }
  return count;
}

function formatTcpEndpointHost(host) {
  const raw = String(host || "").trim();
  if (!raw) return "127.0.0.1";
  if (raw.includes(":") && !raw.startsWith("[") && !raw.endsWith("]")) {
    return `[${raw}]`;
  }
  return raw;
}

module.exports = { loadConfig };
