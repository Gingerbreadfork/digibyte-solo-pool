"use strict";

const EventEmitter = require("node:events");
const { createHash } = require("node:crypto");
const {
  DIFF1_TARGET,
  normalizeHex,
  reverseHex,
  varIntBuffer,
  compactBitsToTarget,
  compactBitsToDifficulty,
  difficultyToTarget,
  doubleSha256,
  bufferToBigIntLE,
  uint32LEBuffer,
  toFixedHexU32,
  nowMs,
  formatPrevhashForStratum
} = require("./utils");
const { buildCoinbasePieces } = require("./coinbase-builder");
const { buildCoinbaseMerkleBranches, computeMerkleRootFromBranches } = require("./merkle");
const { buildBlockHeader, resolveShareVersionHex } = require("./share-crypto");
const { ZmqHashblockSubscriber } = require("./zmq-hashblock-subscriber");

const MAX_RECENT_BLOCKS = 5;
const MAX_NETWORK_BATTLEFIELD = 240;
const MAX_TX_ARTIFACT_CACHE = 8;
const MAX_COINBASE_PIECES_CACHE = 32;
const MAX_DIFFICULTY_SAMPLES = 360;
const DIFFICULTY_TREND_WINDOW = 24;
const DIFFICULTY_TREND_EPSILON_PCT = 0.5;
const BLOCK_STATUS_PENDING = "pending";
const BLOCK_STATUS_CONFIRMED = "confirmed";
const BLOCK_STATUS_ORPHANED = "orphaned";
const KNOWN_POOL_TAG_PATTERNS = [
  { name: "AntPool", re: /antpool|mined by antpool/i },
  { name: "NiceHash", re: /nicehash/i },
  { name: "zpool", re: /zpool/i },
  { name: "ViaBTC", re: /viabtc/i },
  { name: "BTC.com", re: /btc\.com/i },
  { name: "F2Pool", re: /f2pool|discus fish/i },
  { name: "Binance Pool", re: /binance/i },
  { name: "Poolin", re: /poolin/i },
  { name: "EMCD", re: /emcd/i },
  { name: "Luxor", re: /luxor/i },
  { name: "SpiderPool", re: /spiderpool/i },
  { name: "Miningcore", re: /miningcore/i },
  { name: "CKPool", re: /ckpool/i }
];

class JobManager extends EventEmitter {
  constructor(config, logger, rpcClient, stats) {
    super();
    this.config = config;
    this.logger = logger;
    this.rpc = rpcClient;
    this.stats = stats;

    this.running = false;
    this.jobSeq = 0;
    this.currentJob = null;
    this.jobs = new Map();
    this.longpollId = null;
    this.payoutScriptHex = "";
    this.lastTemplateFingerprint = "";
    this.pollTimer = null;
    this.longpollPromise = null;
    this.lastLongpollSuccessAt = 0;
    this.zmqHashblockSubscriber = null;
    this.lastZmqHashblockAt = 0;
    this.zmqTemplateRefreshPending = false;
    this.zmqTemplateRefreshInFlight = null;
    this.prevhashEpochSeq = 0;
    this.templatePollFailureStreak = Math.max(0, Number(this.stats.templatePollFailureStreak || 0));
    this.lastTemplatePollFailureAt = 0;
    this.forceTemplateRefreshOnce = false;
    this.blockStatusTimer = null;
    this.txArtifactsCache = new Map();
    this.coinbasePiecesCache = new Map();
    this.speculativePrebuildSeq = 0;
    this.lastNonceSpaceRefreshAt = 0;
    this.blockArchaeologyFailureStreak = 0;
    this.stats.recentBlocks = sanitizeRecentBlocksForRuntime(this.stats.recentBlocks);
    this.stats.networkBattlefield = sanitizeNetworkBattlefieldForRuntime(this.stats.networkBattlefield);
    this.stats.recentDifficultySamples = sanitizeRecentDifficultySamplesForRuntime(this.stats.recentDifficultySamples);
    this.stats.templatePollFailureStreak = this.templatePollFailureStreak;
    this.stats.totalRewardSats = initializeTotalRewardSats(this.stats);
    applyDifficultyObservatoryStats(this.stats, this.stats.recentDifficultySamples);
  }

  async init() {
    this.payoutScriptHex = await this.resolvePayoutScriptHex();
    this.logger.info("Resolved payout script", {
      payoutScriptHex: this.payoutScriptHex,
      payoutAddress: this.config.poolPayoutAddress || null
    });
  }

  async start() {
    this.running = true;
    await this.verifyNodePowAlgo();
    await this.refreshTemplate("startup");
    this.schedulePoll();
    if (this.config.enableZmqHashblock) {
      this.startZmqHashblockSubscriber();
    }
    if (this.config.enableLongpoll) {
      this.startLongpollLoop();
    }
    this.startBlockStatusMonitor();
  }

  async stop() {
    this.running = false;
    this.speculativePrebuildSeq += 1;
    this.zmqTemplateRefreshPending = false;
    if (this.zmqHashblockSubscriber) {
      this.zmqHashblockSubscriber.stop();
      this.zmqHashblockSubscriber = null;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.blockStatusTimer) {
      clearInterval(this.blockStatusTimer);
      this.blockStatusTimer = null;
    }
  }

  schedulePoll() {
    if (!this.running) return;
    const delayMs = this.nextPollDelayMs();
    this.pollTimer = setTimeout(async () => {
      try {
        await this.refreshTemplate("poll");
      } catch (err) {
        // Failure details are logged/throttled in refreshTemplate().
      } finally {
        this.schedulePoll();
      }
    }, delayMs);
    this.pollTimer.unref?.();
  }

  startLongpollLoop() {
    const loop = async () => {
      let longpollFailureStreak = 0;
      while (this.running) {
        try {
          // Don't measure longpoll latency - it's a blocking wait for new blocks (can be 30+ seconds)
          const tpl = await this.rpc.getBlockTemplate(this.longpollId);
          longpollFailureStreak = 0;
          this.lastLongpollSuccessAt = nowMs();
          this.handleTemplate(tpl, "longpoll");
        } catch (err) {
          longpollFailureStreak += 1;
          const retryMs = backoffMs(longpollFailureStreak, 1000, 15000);
          if (shouldLogFailure(longpollFailureStreak)) {
            this.logger.warn("Longpoll getblocktemplate failed", {
              error: err.message,
              failureStreak: longpollFailureStreak,
              retryMs
            });
          }
          await sleep(retryMs);
        }
      }
    };
    this.longpollPromise = loop();
  }

  startZmqHashblockSubscriber() {
    if (this.zmqHashblockSubscriber) return;
    let subscriber;
    try {
      subscriber = new ZmqHashblockSubscriber(this.config, this.logger.child("zmq-hashblock"));
    } catch (err) {
      this.logger.error("Failed to initialize ZMQ hashblock subscriber", {
        error: err.message,
        endpoint: this.config.zmqHashblockEndpoint || null
      });
      return;
    }

    subscriber.on("hashblock", (evt) => {
      if (!this.running) return;

      this.lastZmqHashblockAt = Number(evt && evt.receivedAt) || nowMs();
      this.stats.lastZmqHashblockAt = this.lastZmqHashblockAt;
      this.stats.lastZmqHashblockHash = evt && evt.blockHashHex ? String(evt.blockHashHex) : null;
      this.stats.lastZmqHashblockSeq = Number.isFinite(evt && evt.sequence)
        ? Number(evt.sequence)
        : null;
      this.queueZmqTemplateRefresh();
    });

    subscriber.on("reconnect", () => {
      this.stats.zmqHashblockReconnects = Math.max(0, Number(this.stats.zmqHashblockReconnects) || 0) + 1;
    });

    this.zmqHashblockSubscriber = subscriber;
    subscriber.start();
  }

  queueZmqTemplateRefresh() {
    this.zmqTemplateRefreshPending = true;
    if (this.zmqTemplateRefreshInFlight) return;

    const run = async () => {
      while (this.running && this.zmqTemplateRefreshPending) {
        this.zmqTemplateRefreshPending = false;
        try {
          await this.refreshTemplate("zmq-hashblock");
        } catch (err) {
          if (this.running) {
            this.logger.warn("Template refresh failed after ZMQ hashblock signal", {
              error: err.message
            });
          }
        }
      }
    };

    this.zmqTemplateRefreshInFlight = run().finally(() => {
      this.zmqTemplateRefreshInFlight = null;
    });
  }

  nextPollDelayMs() {
    const baseMs = Math.max(250, Number(this.config.templatePollMs || 1000));

    // Back off polling while node RPC is unavailable.
    if (this.templatePollFailureStreak > 0) {
      return Math.max(baseMs, backoffMs(this.templatePollFailureStreak, baseMs, 10000));
    }

    const hasFastSignalChannel = Boolean(this.config.enableLongpoll || this.config.enableZmqHashblock);
    if (!hasFastSignalChannel) return baseMs;

    const healthyPollMs = Math.max(baseMs, Number(this.config.templatePollMsLongpollHealthy || baseMs));
    const graceMs = Math.max(1000, Number(this.config.longpollHealthyGraceMs || 120000));
    const lastSuccessAt = Math.max(
      this.config.enableLongpoll ? Number(this.lastLongpollSuccessAt || 0) : 0,
      this.config.enableZmqHashblock ? Number(this.lastZmqHashblockAt || 0) : 0
    );
    if (lastSuccessAt > 0 && (nowMs() - lastSuccessAt) <= graceMs) {
      return healthyPollMs;
    }
    return baseMs;
  }

  startBlockStatusMonitor() {
    const intervalMs = Math.max(5000, Number(this.config.blockStatusCheckMs || 30000));
    const run = async () => {
      try {
        await this.updateBlockStatuses();
      } catch (err) {
        this.recordBlockStatusCheckError(err);
      }
    };

    this.blockStatusTimer = setInterval(run, intervalMs);
    this.blockStatusTimer.unref?.();
    run();
  }

  async updateBlockStatuses() {
    if (!Array.isArray(this.stats.recentBlocks) || this.stats.recentBlocks.length === 0) {
      this.stats.lastBlockCheckAt = Date.now();
      this.stats.blockMonitorLastError = null;
      return;
    }

    const now = Date.now();
    const next = [];
    let hadErrors = false;
    for (let i = 0; i < this.stats.recentBlocks.length; i += 1) {
      const block = this.stats.recentBlocks[i];
      if (!block || typeof block !== "object") continue;
      try {
        next.push(await this.refreshBlockStatus(block, now));
      } catch (err) {
        hadErrors = true;
        this.recordBlockStatusCheckError(err);
        const fallback = normalizeRuntimeBlockEntry(block);
        if (fallback) {
          fallback.lastCheckedAt = now;
          next.push(fallback);
        }
      }
    }

    this.stats.recentBlocks = sanitizeRecentBlocksForRuntime(next);
    if ((Number(this.stats.totalRewardSats) || 0) <= 0 && this.stats.recentBlocks.length > 0) {
      this.stats.totalRewardSats = initializeTotalRewardSats({
        totalRewardSats: 0,
        recentBlocks: this.stats.recentBlocks
      });
    }
    this.stats.lastBlockCheckAt = now;
    if (!hadErrors) {
      this.stats.blockMonitorLastError = null;
    }
  }

  async refreshBlockStatus(block, checkedAt) {
    const out = normalizeRuntimeBlockEntry(block);
    if (!out) return null;

    const previousStatus = out.status;
    const hash = out.hash;

    try {
      const header = await this.rpc.getBlockHeader(hash);
      const confirmations = Number(header && header.confirmations);
      if (Number.isFinite(confirmations) && confirmations > 0) {
        out.status = BLOCK_STATUS_CONFIRMED;
        out.confirmations = confirmations;
      } else if (Number.isFinite(confirmations) && confirmations < 0) {
        out.status = BLOCK_STATUS_ORPHANED;
        out.confirmations = 0;
      } else {
        out.status = BLOCK_STATUS_PENDING;
        out.confirmations = 0;
      }

      const headerHeight = Number(header && header.height);
      if (Number.isFinite(headerHeight) && headerHeight > 0) {
        out.height = Math.floor(headerHeight);
      }
    } catch (err) {
      if (isRpcNotFoundError(err) && out.height > 0) {
        const chainHeightHint = Math.max(0, Math.floor(Number(this.stats.currentHeight) || 0));
        if (chainHeightHint > 0 && out.height >= chainHeightHint) {
          out.status = BLOCK_STATUS_PENDING;
          out.confirmations = 0;
        } else {
          try {
            const mainHash = await this.rpc.getBlockHash(out.height);
            const mainHashNorm = safeNormalizeHex(mainHash);
            if (mainHashNorm && mainHashNorm === out.hash) {
              out.status = BLOCK_STATUS_CONFIRMED;
              out.confirmations = Math.max(1, out.confirmations);
            } else if (mainHashNorm && mainHashNorm !== out.hash) {
              out.status = BLOCK_STATUS_ORPHANED;
              out.confirmations = 0;
            }
          } catch (heightErr) {
            if (isRpcHeightOutOfRangeError(heightErr)) {
              out.status = BLOCK_STATUS_PENDING;
              out.confirmations = 0;
            } else {
              throw heightErr;
            }
          }
        }
      } else {
        throw err;
      }
    }

    out.lastCheckedAt = Math.max(0, Math.floor(Number(checkedAt) || 0));
    if (out.status === BLOCK_STATUS_ORPHANED && previousStatus !== BLOCK_STATUS_ORPHANED) {
      this.stats.totalRewardSats = Math.max(
        0,
        Math.max(0, Number(this.stats.totalRewardSats) || 0)
          - Math.max(0, Math.floor(Number(out.rewardSats) || 0))
      );
      this.stats.blocksOrphaned = Math.max(0, Number(this.stats.blocksOrphaned) || 0) + 1;
    }
    return out;
  }

  recordBlockStatusCheckError(err) {
    const message = err && err.message ? err.message : String(err);
    this.stats.lastBlockCheckAt = Date.now();
    this.stats.blockMonitorErrors = Math.max(0, Number(this.stats.blockMonitorErrors) || 0) + 1;
    this.stats.blockMonitorLastError = String(message).slice(0, 256);
    this.logger.warn("Block status monitor check failed", {
      error: message,
      blocksTracked: Array.isArray(this.stats.recentBlocks) ? this.stats.recentBlocks.length : 0
    });
  }

  async refreshTemplate(source) {
    // Measure actual RPC latency (not longpoll which blocks waiting for new blocks)
    const startTime = nowMs();
    let tpl;
    try {
      tpl = await this.rpc.getBlockTemplate(null);
    } catch (err) {
      this.recordTemplateFetchFailure(source, err);
      throw err;
    }

    const fetchMs = nowMs() - startTime;
    this.recordTemplateFetchLatency(fetchMs);
    this.recordTemplateFetchSuccess(source, fetchMs);
    this.handleTemplate(tpl, source);
  }

  recordTemplateFetchFailure(source, err) {
    this.lastTemplatePollFailureAt = nowMs();
    this.templatePollFailureStreak += 1;
    this.stats.templatePollFailureStreak = this.templatePollFailureStreak;
    // Force longpoll to renegotiate after outage/restart scenarios.
    this.longpollId = null;

    if (shouldLogFailure(this.templatePollFailureStreak)) {
      this.logger.warn("Template poll RPC unavailable", {
        source,
        error: err && err.message ? err.message : String(err),
        failureStreak: this.templatePollFailureStreak
      });
    }
  }

  recordTemplateFetchSuccess(source, fetchMs) {
    if (this.templatePollFailureStreak <= 0) return;
    const recoveredAfter = this.templatePollFailureStreak;
    this.templatePollFailureStreak = 0;
    this.stats.templatePollFailureStreak = this.templatePollFailureStreak;
    this.forceTemplateRefreshOnce = true;
    this.logger.info("Template poll RPC recovered", {
      source,
      fetchMs,
      recoveredAfterFailures: recoveredAfter
    });
  }

  recordTemplateFetchLatency(fetchMs) {
    // Only track reasonable latencies (< 5 seconds)
    // Anything longer is likely a longpoll or network issue
    if (fetchMs > 5000) return;

    this.stats.lastTemplateFetchMs = fetchMs;
    // Exponential moving average (EMA) with 0.3 weight for new values
    // This smooths out volatility while staying responsive to changes
    const prevAvg = this.stats.avgTemplateFetchMs || 0;
    if (prevAvg > 0) {
      this.stats.avgTemplateFetchMs = Math.round((prevAvg * 0.7) + (fetchMs * 0.3));
    } else {
      this.stats.avgTemplateFetchMs = fetchMs;
    }
  }

  recordDifficultySample(template) {
    if (!template || typeof template !== "object") return;

    const bitsHex = safeNormalizeHex(template.bits).padStart(8, "0");
    if (!bitsHex || bitsHex.length !== 8) return;

    const difficulty = compactBitsToDifficulty(bitsHex);
    if (!Number.isFinite(difficulty) || difficulty <= 0) return;

    const sample = {
      t: nowMs(),
      height: Math.max(0, Math.floor(Number(template.height) || 0)),
      bits: bitsHex,
      difficulty
    };

    const samples = sanitizeRecentDifficultySamplesForRuntime(this.stats.recentDifficultySamples);
    const last = samples.length > 0 ? samples[samples.length - 1] : null;
    if (!last || last.bits !== sample.bits || last.height !== sample.height) {
      samples.push(sample);
      while (samples.length > MAX_DIFFICULTY_SAMPLES) {
        samples.shift();
      }
      this.stats.recentDifficultySamples = samples;
    }

    applyDifficultyObservatoryStats(this.stats, this.stats.recentDifficultySamples);
  }

  handleTemplate(template, source) {
    if (!template || typeof template !== "object") {
      throw new Error("GBT returned empty template");
    }

    this.stats.templatesFetched += 1;
    this.longpollId = template.longpollid || this.longpollId;

    const templateAlgo = extractTemplateAlgo(template);
    if (templateAlgo && String(templateAlgo).toLowerCase() !== String(this.config.powAlgo).toLowerCase()) {
      this.logger.warn("Ignoring non-matching template algo", {
        source,
        templateAlgo,
        expectedAlgo: this.config.powAlgo,
        height: template.height,
        bits: template.bits || null
      });
      return;
    }

    this.recordDifficultySample(template);

    const fingerprint = buildTemplateFingerprint(template, this.config.templateFingerprintMode);

    const forceRefresh = this.forceTemplateRefreshOnce;
    this.forceTemplateRefreshOnce = false;

    if (fingerprint === this.lastTemplateFingerprint && source !== "startup" && !forceRefresh) {
      return;
    }

    const previousJob = this.currentJob;
    const isNewPrev = !previousJob ||
      previousJob.template.previousblockhash !== template.previousblockhash;
    const prevhashEpoch = isNewPrev
      ? (++this.prevhashEpochSeq)
      : (previousJob ? previousJob.prevhashEpoch : Math.max(1, this.prevhashEpochSeq));
    const originalTxCount = countTemplateTransactions(template);

    let fastpathBroadcasted = false;
    if (
      this.config.enableNewBlockFastpath
      && (source === "longpoll" || source === "zmq-hashblock")
      && isNewPrev
    ) {
      const fastTemplate = buildTruncatedTemplate(template, this.config.newBlockFastpathTxLimit);
      if (fastTemplate) {
        fastpathBroadcasted = true;
        const fastJob = this.buildJobFromTemplate(fastTemplate, true, prevhashEpoch, { templateVariant: "fastpath" });
        this.publishJob(fastJob, source, { originalTxCount, isFollowup: false });
      }
    }

    const fullJob = this.buildJobFromTemplate(template, isNewPrev || fastpathBroadcasted, prevhashEpoch, {
      templateVariant: fastpathBroadcasted ? "full-followup" : "full"
    });
    this.publishJob(fullJob, source, { originalTxCount, isFollowup: fastpathBroadcasted });
    if (isNewPrev) {
      this.queuePreviousBlockArchaeology(template);
    }
    this.scheduleSpeculativeNextTemplatePrebuild(template);
    this.lastTemplateFingerprint = fingerprint;
  }

  queuePreviousBlockArchaeology(template) {
    const previousBlockHash = safeNormalizeHex(template && template.previousblockhash);
    if (!previousBlockHash) return;

    const nextTemplateHeight = Math.max(0, Math.floor(Number(template && template.height) || 0));
    this.capturePreviousBlockArchaeology(previousBlockHash, nextTemplateHeight).catch((err) => {
      this.blockArchaeologyFailureStreak += 1;
      if (shouldLogFailure(this.blockArchaeologyFailureStreak)) {
        this.logger.warn("Coinbase archaeology fetch failed", {
          error: err && err.message ? err.message : String(err),
          previousBlockHash,
          failureStreak: this.blockArchaeologyFailureStreak
        });
      }
    });
  }

  async capturePreviousBlockArchaeology(previousBlockHash, nextTemplateHeight) {
    const block = await this.rpc.getBlock(previousBlockHash, 1);
    const txids = Array.isArray(block && block.tx) ? block.tx : [];
    const coinbaseTxid = safeNormalizeHex(txids[0]);

    let coinbaseScriptSigHex = "";
    if (coinbaseTxid) {
      let rawTx = null;
      try {
        rawTx = await this.rpc.getRawTransaction(coinbaseTxid, true, previousBlockHash);
      } catch (_err) {
        rawTx = await this.rpc.getRawTransaction(coinbaseTxid, true);
      }
      coinbaseScriptSigHex = normalizeCoinbaseScriptSigHex(rawTx);
    }

    const heightHint = Math.max(0, nextTemplateHeight - 1);
    const height = Math.max(0, Math.floor(Number(block && block.height) || heightHint));
    const bits = safeNormalizeHex(block && block.bits).padStart(8, "0");
    const difficultyRpc = Number(block && block.difficulty);
    const difficulty = (Number.isFinite(difficultyRpc) && difficultyRpc > 0)
      ? difficultyRpc
      : (bits ? compactBitsToDifficulty(bits) : 0);

    const blockTimeSec = Number(block && (block.time || block.mediantime || 0));
    const timestamp = normalizeTimestampMs(blockTimeSec > 0 ? blockTimeSec * 1000 : Date.now());
    const attribution = classifyCoinbaseAttribution(coinbaseScriptSigHex, this.config.poolTag);

    pushNetworkBattlefield(this.stats, {
      hash: previousBlockHash,
      height,
      timestamp,
      bits,
      difficulty,
      coinbaseTxid,
      coinbaseTagRaw: attribution.tagRaw,
      poolName: attribution.poolName,
      isOurPool: attribution.isOurPool
    });

    if (this.blockArchaeologyFailureStreak > 0) {
      this.logger.info("Coinbase archaeology fetch recovered", {
        previousBlockHash,
        recoveredAfterFailures: this.blockArchaeologyFailureStreak
      });
    }
    this.blockArchaeologyFailureStreak = 0;
  }

  publishJob(job, source, options) {
    const opts = options || {};
    this.currentJob = job;
    this.jobs.set(job.jobId, job);
    this.pruneOldJobs();

    this.stats.currentHeight = job.template.height || 0;
    this.stats.lastTemplateAt = Date.now();
    this.stats.lastTemplateSource = source;
    this.stats.currentNetworkBits = job.template.bits || null;

    this.emit("job", job);

    const txCount = 1 + job.transactions.length;
    const originalTxCount = 1 + Math.max(job.transactions.length, Number(opts.originalTxCount || 0));
    if (this.config.logNewJobs) {
      this.logger.info("New mining job", {
        source,
        jobId: job.jobId,
        height: job.template.height,
        txCount,
        originalTxCount,
        cleanJobs: Boolean(job.cleanJobs),
        segwit: job.segwit,
        templateVariant: job.templateVariant,
        txArtifactsCacheHit: Boolean(job.txArtifactsCacheHit),
        coinbasePiecesCacheHit: Boolean(job.coinbasePiecesCacheHit),
        followupFromFastpath: Boolean(opts.isFollowup)
      });
    }
  }

  scheduleSpeculativeNextTemplatePrebuild(template) {
    if (!this.config.enableSpeculativeNextTemplatePrebuild) return;
    if (!template || typeof template !== "object") return;
    if (!this.running) return;

    const baseHeight = Math.max(0, Math.floor(Number(template.height) || 0));
    if (baseHeight <= 0) return;

    const baseCurtime = Math.max(0, Math.floor(Number(template.curtime) || 0));
    const nextTemplate = {
      ...template,
      height: baseHeight + 1,
      curtime: baseCurtime > 0 ? baseCurtime + 1 : baseCurtime,
      mintime: Math.max(0, Math.floor(Number(template.mintime || template.curtime || 0))) + 1,
      maxtime: Math.max(0, Math.floor(Number(template.maxtime || (template.curtime || 0) + 600))) + 1
    };

    const seq = ++this.speculativePrebuildSeq;
    setImmediate(() => {
      if (!this.running) return;
      if (seq !== this.speculativePrebuildSeq) return;
      try {
        const txs = Array.isArray(nextTemplate.transactions) ? nextTemplate.transactions : [];
        this.getOrBuildTxArtifacts(txs);
        const segwitCommitmentScript = nextTemplate.default_witness_commitment
          ? normalizeHex(nextTemplate.default_witness_commitment)
          : "";
        this.getOrBuildCoinbasePieces(nextTemplate, segwitCommitmentScript);
      } catch (err) {
        this.logger.debug("Speculative next-template prebuild failed", {
          error: err.message,
          height: nextTemplate.height || 0
        });
      }
    });
  }

  getOrBuildTxArtifacts(txs) {
    const key = buildTxArtifactsKey(txs);
    const cached = readLruCacheEntry(this.txArtifactsCache, key);
    if (cached) {
      return { artifacts: cached, cacheHit: true };
    }

    const txidLeaves = txs.map((tx) => Buffer.from(reverseHex(getTemplateTxidHex(tx)), "hex"));
    const merkleBranchesRaw = buildCoinbaseMerkleBranches(txidLeaves);
    const artifacts = {
      key,
      merkleBranchesRaw,
      merkleBranchesHex: merkleBranchesRaw.map((b) => b.toString("hex"))
    };
    writeLruCacheEntry(this.txArtifactsCache, key, artifacts, MAX_TX_ARTIFACT_CACHE);
    return { artifacts, cacheHit: false };
  }

  getOrBuildCoinbasePieces(template, segwitCommitmentScript) {
    const key = buildCoinbasePiecesKey(template, segwitCommitmentScript);
    const cached = readLruCacheEntry(this.coinbasePiecesCache, key);
    if (cached) {
      return { coinbasePieces: cached, cacheHit: true };
    }

    const coinbasePieces = buildCoinbasePieces({
      template,
      payoutScriptHex: this.payoutScriptHex,
      poolTag: this.config.poolTag,
      extranonce1Size: this.config.extranonce1Size,
      extranonce2Size: this.config.extranonce2Size,
      segwitCommitmentScript
    });
    writeLruCacheEntry(this.coinbasePiecesCache, key, coinbasePieces, MAX_COINBASE_PIECES_CACHE);
    return { coinbasePieces, cacheHit: false };
  }

  pruneOldJobs() {
    const keep = Math.max(1, this.config.keepOldJobs);
    while (this.jobs.size > keep) {
      const firstKey = this.jobs.keys().next().value;
      this.jobs.delete(firstKey);
    }
  }

  async resolvePayoutScriptHex() {
    if (this.config.poolPayoutScriptHex) {
      return normalizeHex(this.config.poolPayoutScriptHex);
    }

    const addr = this.config.poolPayoutAddress;
    if (!addr) {
      throw new Error("POOL_PAYOUT_ADDRESS missing");
    }

    const val = await this.rpc.validateAddress(addr);
    if (!val) {
      throw new Error(
        "validateaddress RPC failed (node unreachable or RPC error). " +
        "Set POOL_PAYOUT_SCRIPT_HEX to bypass address lookup while testing RPC connectivity."
      );
    }
    if (!val.isvalid) {
      throw new Error("Pool payout address is invalid according to node");
    }
    if (!val.scriptPubKey) {
      throw new Error("validateaddress did not return scriptPubKey; set POOL_PAYOUT_SCRIPT_HEX");
    }
    return normalizeHex(val.scriptPubKey);
  }

  async verifyNodePowAlgo() {
    const miningInfo = await this.rpc.getMiningInfo?.();
    if (!miningInfo || typeof miningInfo !== "object") return;

    const nodePowAlgo = miningInfo.pow_algo || miningInfo.algo || miningInfo.algorithm || "";
    const nodePowAlgoId = miningInfo.pow_algo_id;
    if (!nodePowAlgo) return;

    const actual = String(nodePowAlgo).toLowerCase();
    const expected = String(this.config.powAlgo || "").toLowerCase();
    if (!expected || actual === expected) {
      this.logger.info("Verified node mining algo", {
        nodePowAlgo,
        nodePowAlgoId: nodePowAlgoId ?? null,
        expectedAlgo: this.config.powAlgo
      });
      return;
    }

    const fields = {
      nodePowAlgo,
      nodePowAlgoId: nodePowAlgoId ?? null,
      expectedAlgo: this.config.powAlgo,
      allowOverride: Boolean(this.config.allowNodePowAlgoMismatch)
    };
    if (this.config.allowNodePowAlgoMismatch) {
      this.logger.warn("Node mining algo does not match pool POW_ALGO", fields);
      return;
    }

    throw new Error(
      `Node mining algo mismatch: node reports '${nodePowAlgo}', pool expects '${this.config.powAlgo}'. ` +
      "Point NODE_RPC_* to a SHA256D DigiByte daemon (often a dedicated daemon instance) or set ALLOW_NODE_POW_ALGO_MISMATCH=true to bypass."
    );
  }

  buildJobFromTemplate(template, cleanJobs, prevhashEpoch, options) {
    const opts = options || {};
    const txs = Array.isArray(template.transactions) ? template.transactions : [];
    const segwitCommitmentScript = template.default_witness_commitment
      ? normalizeHex(template.default_witness_commitment)
      : "";

    const coinbaseResult = this.getOrBuildCoinbasePieces(template, segwitCommitmentScript);
    const coinbasePieces = coinbaseResult.coinbasePieces;
    const txArtifactsResult = this.getOrBuildTxArtifacts(txs);
    const merkleBranchesRaw = txArtifactsResult.artifacts.merkleBranchesRaw;
    const merkleBranchesHex = txArtifactsResult.artifacts.merkleBranchesHex;

    const prevhashHex = normalizeHex(template.previousblockhash);
    const networkTarget = resolveTemplateTarget(template);
    const jobId = (++this.jobSeq).toString(16);
    const ntimeHex = toFixedHexU32(template.curtime);
    const versionHex = toFixedHexU32(template.version);
    const maxTrackedSubmissions = Math.max(1000, Number(this.config.maxJobSubmissionsTracked || 50000));

    const job = {
      jobId,
      createdAt: nowMs(),
      cleanJobs,
      prevhashEpoch: Math.max(1, Number(prevhashEpoch || 1)),
      segwit: Boolean(segwitCommitmentScript),
      templateVariant: opts.templateVariant || "full",
      txArtifactsCacheHit: txArtifactsResult.cacheHit,
      coinbasePiecesCacheHit: coinbaseResult.cacheHit,
      template,
      workId: template.workid ? String(template.workid) : "",
      templateAlgo: extractTemplateAlgo(template) || "",
      transactions: txs,
      transactionsHexJoined: null,
      networkTarget,
      prevhashRpcHex: prevhashHex,
      prevhashHeaderRaw: Buffer.from(reverseHex(prevhashHex), "hex"),
      prevhashNotifyHex: formatPrevhashForStratum(prevhashHex, this.config.stratumPrevhashMode),
      prevhashNotifyHexByMode: {
        stratum: formatPrevhashForStratum(prevhashHex, "stratum"),
        stratum_wordrev: formatPrevhashForStratum(prevhashHex, "stratum_wordrev"),
        header: formatPrevhashForStratum(prevhashHex, "header"),
        rpc: formatPrevhashForStratum(prevhashHex, "rpc")
      },
      versionHex,
      bitsHex: normalizeHex(template.bits).padStart(8, "0"),
      ntimeHex,
      minTime: Number(template.mintime || template.curtime || 0),
      maxTime: Number(template.maxtime || (template.curtime || 0) + 600),
      coinbase1Hex: coinbasePieces.merkleCoinbase1Hex,
      coinbase1Raw: coinbasePieces.merkleCoinbase1Raw,
      coinbase2Hex: coinbasePieces.merkleCoinbase2Hex,
      coinbase2Raw: coinbasePieces.merkleCoinbase2Raw,
      blockCoinbase1Hex: coinbasePieces.blockCoinbase1Hex,
      blockCoinbase2Hex: coinbasePieces.blockCoinbase2Hex,
      merkleBranchesRaw,
      merkleBranchesHex,
      submissions: new Set(),
      submissionsRing: new Array(maxTrackedSubmissions),
      submissionsRingPos: 0,
      submissionsRingSize: 0,
      prewarmScheduled: false
    };

    job.notifyLinesByMode = buildNotifyLinesByMode(job);
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(String(jobId));
  }

  currentJobSnapshot() {
    return this.currentJob;
  }

  getShareTargetForDifficulty(diff) {
    return difficultyToTarget(diff);
  }

  validateShareSubmission({ client, workerName, jobId, extranonce2Hex, ntimeHex, nonceHex, versionBitsHex }) {
    const job = this.getJob(jobId);
    if (!job) {
      return reject("stale", "Job not found");
    }
    if (this.currentJob && Number(job.prevhashEpoch || 0) < Number(this.currentJob.prevhashEpoch || 0)) {
      return reject("stale", "Job superseded by clean job");
    }

    const ex2 = normalizeHex(extranonce2Hex);
    const ex2Buf = Buffer.from(ex2, "hex");
    const ntime = normalizeHex(ntimeHex).padStart(8, "0");
    const nonce = normalizeHex(nonceHex).padStart(8, "0");

    if (ex2Buf.length !== this.config.extranonce2Size) {
      return reject("invalid", `Bad extranonce2 size (expected ${this.config.extranonce2Size} bytes)`);
    }
    if (ntime.length !== 8 || nonce.length !== 8) {
      return reject("invalid", "ntime and nonce must be 4-byte hex");
    }

    const ntimeNum = Number.parseInt(ntime, 16);
    if (Number.isNaN(ntimeNum) || ntimeNum < job.minTime || ntimeNum > job.maxTime + 7200) {
      return reject("stale", "ntime out of range");
    }

    const versionResolution = resolveShareVersionHex({
      baseVersionHex: job.versionHex,
      versionBitsHex,
      versionRollingEnabled: Boolean(client.versionRollingEnabled),
      versionRollingMaskHex: client.versionRollingMaskHex || "00000000"
    });
    if (!versionResolution.ok) {
      return reject("invalid", versionResolution.message);
    }

    const dedupeKey =
      `${client.extranonce1Hex}:${jobId}:${ex2}:${ntime}:${nonce}:${versionResolution.versionHex}`;
    if (job.submissions.has(dedupeKey)) {
      return reject("duplicate", "Duplicate share");
    }
    rememberSubmission(job, dedupeKey);

    const coinbaseRaw = Buffer.concat([
      job.coinbase1Raw,
      client.extranonce1Raw || Buffer.from(client.extranonce1Hex, "hex"),
      ex2Buf,
      job.coinbase2Raw
    ]);
    const coinbaseHash = doubleSha256(coinbaseRaw);
    const merkleRoot = computeMerkleRootFromBranches(coinbaseHash, job.merkleBranchesRaw);
    const header = buildBlockHeader({
      versionHex: versionResolution.versionHex,
      prevhashRaw: job.prevhashHeaderRaw,
      merkleRootRaw: merkleRoot,
      ntimeHex: ntime,
      bitsHex: job.bitsHex,
      nonceHex: nonce
    });
    const headerHash = doubleSha256(header);
    const headerHashInt = bufferToBigIntLE(headerHash);
    const shareDifficulty = headerHashInt > 0n
      ? (DIFF1_TARGET / headerHashInt)
      : 0n;

    const shareTarget = (typeof client.shareTarget === "bigint" && client.shareTarget > 0n)
      ? client.shareTarget
      : this.getShareTargetForDifficulty(client.difficulty);
    if (headerHashInt > shareTarget) {
      this.maybeLogShareValidationDiagnostics({
        client,
        job,
        coinbaseHash,
        merkleRoot,
        versionHex: versionResolution.versionHex,
        versionBitsHex: versionResolution.versionBitsHex,
        ntimeHex: ntime,
        nonceHex: nonce,
        shareTarget,
        headerHashInt,
        shareDifficulty
      });
      return reject("lowdiff", "Low difficulty share", {
        shareDifficulty: shareDifficulty.toString(),
        shareHashHex: Buffer.from(headerHash).reverse().toString("hex")
      });
    }

    const shareHashHex = Buffer.from(headerHash).reverse().toString("hex");
    const result = {
      ok: true,
      isBlockCandidate: headerHashInt <= job.networkTarget,
      shareHashHex,
      headerHashInt,
      shareDifficulty: shareDifficulty.toString(),
      assignedDifficulty: client.difficulty,
      versionHex: versionResolution.versionHex,
      versionBitsHex: versionResolution.versionBitsHex,
      job,
      coinbaseRaw,
      merkleRootRaw: merkleRoot,
      headerRaw: header,
      extranonce2Hex: ex2,
      ntimeHex: ntime,
      nonceHex: nonce,
      workerName
    };

    return result;
  }

  async submitBlockCandidate(shareResult, client) {
    const { job, extranonce2Hex } = shareResult;
    const blockCoinbaseHex =
      job.blockCoinbase1Hex + client.extranonce1Hex + extranonce2Hex + job.blockCoinbase2Hex;

    const txCount = varIntBuffer(1 + job.transactions.length).toString("hex");
    const headerHex = (Buffer.isBuffer(shareResult.headerRaw)
      ? shareResult.headerRaw
      : buildBlockHeader({
        versionHex: shareResult.versionHex || job.versionHex,
        prevhashRaw: job.prevhashHeaderRaw,
        merkleRootRaw: Buffer.isBuffer(shareResult.merkleRootRaw)
          ? shareResult.merkleRootRaw
          : computeMerkleRootFromBranches(doubleSha256(shareResult.coinbaseRaw), job.merkleBranchesRaw),
        ntimeHex: shareResult.ntimeHex,
        bitsHex: job.bitsHex,
        nonceHex: shareResult.nonceHex
      })
    ).toString("hex");

    const blockHex = headerHex + txCount + blockCoinbaseHex + getJoinedBlockTransactionsHex(job);
    const submitResult = await this.rpc.submitBlock(blockHex, job.workId);

    if (submitResult === null) {
      this.stats.blocksFound += 1;
      const foundAt = Date.now();
      const coinbaseTxid = Buffer.from(doubleSha256(Buffer.from(blockCoinbaseHex, "hex")))
        .reverse()
        .toString("hex");
      const rewardSats = Math.max(0, Math.floor(Number(job.template && job.template.coinbasevalue) || 0));
      this.stats.totalRewardSats = Math.max(0, Number(this.stats.totalRewardSats) || 0) + rewardSats;
      this.stats.lastFoundBlockHash = shareResult.shareHashHex;
      this.stats.lastFoundBlockAt = foundAt;
      pushRecentBlock(this.stats, {
        hash: shareResult.shareHashHex,
        height: job.template.height,
        worker: shareResult.workerName || "unknown",
        timestamp: foundAt,
        status: BLOCK_STATUS_PENDING,
        confirmations: 0,
        coinbaseTxid,
        rewardSats,
        lastCheckedAt: 0
      });
      this.logger.info("Block candidate accepted by node", {
        blockHash: shareResult.shareHashHex,
        height: job.template.height,
        worker: shareResult.workerName
      });
      this.emit("blockAccepted", {
        blockHash: shareResult.shareHashHex,
        height: job.template.height,
        workerName: shareResult.workerName,
        foundAt
      });
      return { accepted: true, blockHash: shareResult.shareHashHex, nodeResult: null };
    }

    this.stats.blocksRejected += 1;
    this.logger.warn("Block candidate rejected by node", {
      blockHash: shareResult.shareHashHex,
      reason: submitResult
    });
    return { accepted: false, blockHash: shareResult.shareHashHex, nodeResult: submitResult };
  }

  maybePrewarmBlockCandidatePayload(shareResult) {
    if (!this.config.enableNearCandidatePrewarm) return;
    if (!shareResult || !shareResult.ok || shareResult.isBlockCandidate) return;
    const job = shareResult.job;
    if (!job || typeof job !== "object") return;
    if (typeof job.transactionsHexJoined === "string") return;
    if (job.prewarmScheduled) return;

    const factorNum = Math.max(2, Number(this.config.nearCandidatePrewarmFactor || 256));
    const factor = BigInt(factorNum);
    if (typeof shareResult.headerHashInt !== "bigint" || typeof job.networkTarget !== "bigint") return;
    if (shareResult.headerHashInt > (job.networkTarget * factor)) return;

    job.prewarmScheduled = true;
    setImmediate(() => {
      job.prewarmScheduled = false;
      try {
        getJoinedBlockTransactionsHex(job);
      } catch (err) {
        this.logger.debug("Near-candidate prewarm failed", {
          jobId: job.jobId,
          error: err.message
        });
      }
    });
  }

  requestNonceSpaceRefresh(context) {
    if (!this.running) return false;
    if (!this.currentJob || !this.currentJob.template) return false;

    const now = nowMs();
    const globalCooldownMs = Math.max(1000, Number(this.config.nonceSpaceRefreshCooldownMs || 8000));
    if ((now - this.lastNonceSpaceRefreshAt) < Math.floor(globalCooldownMs / 2)) {
      return false;
    }

    const baseJob = this.currentJob;
    const baseTemplate = baseJob.template;
    const baseCurtime = Math.max(0, Math.floor(Number(baseTemplate.curtime) || 0));
    const minTime = Math.max(0, Math.floor(Number(baseTemplate.mintime || baseCurtime || 0)));
    const maxTimeHint = Math.max(
      minTime,
      Math.floor(Number(baseTemplate.maxtime || (baseCurtime || 0) + 600))
    );
    const nowSec = Math.floor(now / 1000);
    const nextCurtime = Math.max(minTime, Math.min(maxTimeHint, Math.max(nowSec, baseCurtime + 1)));
    if (nextCurtime <= baseCurtime) {
      return false;
    }

    const refreshedTemplate = {
      ...baseTemplate,
      curtime: nextCurtime,
      mintime: minTime,
      maxtime: maxTimeHint
    };

    const refreshedJob = this.buildJobFromTemplate(
      refreshedTemplate,
      false,
      baseJob.prevhashEpoch,
      { templateVariant: "nonce-refresh" }
    );
    this.publishJob(refreshedJob, "nonce-refresh", {
      originalTxCount: countTemplateTransactions(baseTemplate),
      isFollowup: false
    });
    this.lastNonceSpaceRefreshAt = now;

    const fields = context && typeof context === "object" ? context : {};
    this.logger.info("Refreshed nonce space for active job", {
      trigger: fields.trigger || "unknown",
      clientId: fields.clientId || null,
      worker: fields.worker || null,
      previousNtime: baseCurtime,
      newNtime: nextCurtime
    });
    return true;
  }

  maybeLogShareValidationDiagnostics({
    client,
    job,
    coinbaseHash,
    merkleRoot,
    versionHex,
    versionBitsHex,
    ntimeHex,
    nonceHex,
    shareTarget,
    headerHashInt,
    shareDifficulty
  }) {
    if (!this.config.debugShareValidation) return;

    client.debugLowDiffLogs = (client.debugLowDiffLogs || 0) + 1;
    const n = client.debugLowDiffLogs;
    if (!(n <= 5 || n % 50 === 0)) return;

    const variants = buildHeaderDiagnostics({
      versionHex: job.versionHex,
      // Diagnostics currently vary only time/bits/nonce; include effective version for context.
      effectiveVersionHex: versionHex,
      versionBitsHex: versionBitsHex || null,
      prevhashRaw: job.prevhashHeaderRaw,
      merkleRootRaw: merkleRoot,
      ntimeHex,
      bitsHex: job.bitsHex,
      nonceHex,
      shareTarget
    });

    const current = variants.find((v) =>
      v.ntimeMode === "u32le" && v.bitsMode === "reverse" && v.nonceMode === "reverse"
    );
    const best = variants.reduce((acc, v) => {
      if (!acc) return v;
      return v.shareDifficulty > acc.shareDifficulty ? v : acc;
    }, null);
    const passing = variants.filter((v) => v.headerHashInt <= shareTarget);

    this.logger.warn("Share validation diagnostic (lowdiff)", {
      clientId: client.id,
      remote: client.remote,
      worker: client.workerName,
      diagIndex: n,
      jobId: job.jobId,
      assignedDifficulty: Number(client.difficulty),
      observedShareDifficulty: String(shareDifficulty),
      effectiveVersionHex: versionHex,
      versionBitsHex: versionBitsHex || null,
      coinbaseHash: Buffer.from(coinbaseHash).reverse().toString("hex"),
      merkleRoot: Buffer.from(merkleRoot).reverse().toString("hex"),
      ntimeHex,
      nonceHex,
      currentVariant: current ? summarizeHeaderVariant(current) : null,
      bestVariant: best ? summarizeHeaderVariant(best) : null,
      passingVariants: passing.map(summarizeHeaderVariant)
    });
  }
}


function buildHeaderDiagnostics({
  versionHex,
  effectiveVersionHex,
  versionBitsHex,
  prevhashRaw,
  merkleRootRaw,
  ntimeHex,
  bitsHex,
  nonceHex,
  shareTarget
}) {
  const selectedVersionHex = effectiveVersionHex || versionHex;
  const versionLe = uint32LEBuffer(Number.parseInt(selectedVersionHex, 16));
  const timeBytes = {
    u32le: uint32LEBuffer(Number.parseInt(ntimeHex, 16)),
    raw: Buffer.from(normalizeHex(ntimeHex), "hex")
  };
  const bitsBytes = {
    reverse: Buffer.from(normalizeHex(bitsHex), "hex").reverse(),
    raw: Buffer.from(normalizeHex(bitsHex), "hex")
  };
  const nonceBytes = {
    reverse: Buffer.from(normalizeHex(nonceHex), "hex").reverse(),
    raw: Buffer.from(normalizeHex(nonceHex), "hex")
  };

  const out = [];
  for (const [ntimeMode, ntimeBuf] of Object.entries(timeBytes)) {
    for (const [bitsMode, bitsBuf] of Object.entries(bitsBytes)) {
      for (const [nonceMode, nonceBuf] of Object.entries(nonceBytes)) {
        const header = Buffer.concat([
          versionLe,
          prevhashRaw,
          merkleRootRaw,
          ntimeBuf,
          bitsBuf,
          nonceBuf
        ]);
        const headerHash = doubleSha256(header);
        const headerHashInt = bufferToBigIntLE(headerHash);
        const computedDiff = headerHashInt > 0n ? (DIFF1_TARGET / headerHashInt) : 0n;
        out.push({
          ntimeMode,
          bitsMode,
          nonceMode,
          headerHashInt,
          shareDifficulty: computedDiff,
          shareHashHex: Buffer.from(headerHash).reverse().toString("hex"),
          passesTarget: headerHashInt <= shareTarget
        });
      }
    }
  }
  return out;
}

function summarizeHeaderVariant(v) {
  return {
    ntimeMode: v.ntimeMode,
    bitsMode: v.bitsMode,
    nonceMode: v.nonceMode,
    passesTarget: v.passesTarget,
    shareDifficulty: v.shareDifficulty.toString(),
    shareHash: v.shareHashHex
  };
}

function reject(code, message, extra) {
  return Object.assign({ ok: false, code, message }, extra || {});
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldLogFailure(streak) {
  return streak <= 3 || streak % 10 === 0;
}

function backoffMs(streak, baseMs, maxMs) {
  const s = Math.max(1, Number(streak || 1));
  const base = Math.max(1, Number(baseMs || 1000));
  const max = Math.max(base, Number(maxMs || base));
  const exponent = Math.min(6, s - 1);
  return Math.min(max, base * (2 ** exponent));
}

function buildTemplateFingerprint(template, mode) {
  const txs = Array.isArray(template.transactions) ? template.transactions : [];
  const fingerprintMode = String(mode || "fast").toLowerCase();
  if (fingerprintMode === "prevhash") {
    return [
      template.previousblockhash || "",
      template.height || 0,
      template.version || 0,
      template.bits || ""
    ].join(":");
  }

  let txComponent = "";
  if (fingerprintMode === "full") {
    txComponent = txs
      .map((tx) => tx.txid || tx.hash || "")
      .join(",");
  } else {
    // Fast mode: capture most mempool/template changes without hashing the full tx list.
    const count = txs.length;
    if (count > 0) {
      const head = [];
      const tail = [];
      const headCount = Math.min(4, count);
      const tailCount = Math.min(4, Math.max(0, count - headCount));
      for (let i = 0; i < headCount; i += 1) {
        head.push(txs[i].txid || txs[i].hash || "");
      }
      for (let i = count - tailCount; i < count; i += 1) {
        tail.push(txs[i].txid || txs[i].hash || "");
      }
      txComponent = `${count}|${head.join(",")}|${tail.join(",")}`;
    } else {
      txComponent = "0";
    }
  }

  // Do not include curtime/mintime: many nodes advance those every second, which
  // would force pointless job churn and extra latency/noise for miners.
  return [
    template.previousblockhash || "",
    template.height || 0,
    template.version || 0,
    template.bits || "",
    template.coinbasevalue || 0,
    template.default_witness_commitment || "",
    txComponent
  ].join(":");
}

function countTemplateTransactions(template) {
  return Array.isArray(template && template.transactions) ? template.transactions.length : 0;
}

function buildTruncatedTemplate(template, txLimit) {
  const txs = Array.isArray(template && template.transactions) ? template.transactions : [];
  const limit = Math.max(0, Math.floor(Number(txLimit || 0)));
  if (txs.length <= limit) {
    return null;
  }
  return {
    ...template,
    transactions: txs.slice(0, limit)
  };
}

function getTemplateTxidHex(tx) {
  const txidHex = tx && (tx.txid || tx.hash);
  if (!txidHex) throw new Error("GBT transaction missing txid/hash");
  return normalizeHex(txidHex);
}

function buildTxArtifactsKey(txs) {
  if (!Array.isArray(txs) || txs.length === 0) return "0";
  const hash = createHash("sha256");
  hash.update(String(txs.length));
  for (let i = 0; i < txs.length; i += 1) {
    hash.update(":");
    hash.update(getTemplateTxidHex(txs[i]));
  }
  return `sha256:${hash.digest("hex")}`;
}

function buildCoinbasePiecesKey(template, segwitCommitmentScript) {
  const coinbaseAuxFlags = template && template.coinbaseaux && template.coinbaseaux.flags
    ? normalizeHex(template.coinbaseaux.flags)
    : "";
  return [
    Math.max(0, Math.floor(Number(template && template.height) || 0)),
    Math.max(0, Math.floor(Number(template && template.coinbasevalue) || 0)),
    coinbaseAuxFlags,
    segwitCommitmentScript || ""
  ].join(":");
}

function readLruCacheEntry(cache, key) {
  if (!cache || !cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function writeLruCacheEntry(cache, key, value, maxEntries) {
  if (!cache) return;
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  const max = Math.max(1, Number(maxEntries || 1));
  while (cache.size > max) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function resolveTemplateTarget(template) {
  const targetHex = template && typeof template.target === "string"
    ? normalizeHex(template.target)
    : "";
  if (targetHex) {
    return BigInt(`0x${targetHex}`);
  }
  return compactBitsToTarget(template.bits);
}

function rememberSubmission(job, dedupeKey) {
  const ring = job.submissionsRing;
  if (!Array.isArray(ring) || ring.length === 0) {
    job.submissions.add(dedupeKey);
    return;
  }

  const cap = ring.length;
  if (job.submissionsRingSize >= cap) {
    const evicted = ring[job.submissionsRingPos];
    if (evicted !== undefined) {
      job.submissions.delete(evicted);
    }
  } else {
    job.submissionsRingSize += 1;
  }

  ring[job.submissionsRingPos] = dedupeKey;
  job.submissionsRingPos = (job.submissionsRingPos + 1) % cap;
  job.submissions.add(dedupeKey);
}

function extractTemplateAlgo(template) {
  if (!template || typeof template !== "object") return "";
  const keys = ["algo", "pow_algo", "powalgo", "algorithm"];
  for (const key of keys) {
    if (template[key] !== undefined && template[key] !== null && String(template[key]) !== "") {
      return String(template[key]);
    }
  }
  return "";
}

function getJoinedBlockTransactionsHex(job) {
  if (typeof job.transactionsHexJoined === "string") {
    return job.transactionsHexJoined;
  }
  const txs = Array.isArray(job.transactions) ? job.transactions : [];
  const joined = txs.map((tx) => normalizeHex(tx.data)).join("");
  job.transactionsHexJoined = joined;
  return joined;
}

function buildNotifyLinesByMode(job) {
  const modes = job.prevhashNotifyHexByMode || {};
  const out = Object.create(null);
  for (const mode of Object.keys(modes)) {
    out[mode] = Object.create(null);
    out[mode]["0"] = JSON.stringify(buildNotifyPayload(job, modes[mode], false)) + "\n";
    out[mode]["1"] = JSON.stringify(buildNotifyPayload(job, modes[mode], true)) + "\n";
  }
  return out;
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

function pushRecentBlock(stats, block) {
  if (!stats || typeof stats !== "object") return;
  stats.recentBlocks = sanitizeRecentBlocksForRuntime(stats.recentBlocks);
  const entry = normalizeRuntimeBlockEntry(block);
  if (!entry) return;
  const deduped = stats.recentBlocks.filter((item) => item && item.hash !== entry.hash);
  deduped.unshift(entry);
  if (deduped.length > MAX_RECENT_BLOCKS) {
    deduped.length = MAX_RECENT_BLOCKS;
  }
  stats.recentBlocks = deduped;
}

function pushNetworkBattlefield(stats, entry) {
  if (!stats || typeof stats !== "object") return;
  stats.networkBattlefield = sanitizeNetworkBattlefieldForRuntime(stats.networkBattlefield);
  const normalized = normalizeRuntimeBattlefieldEntry(entry);
  if (!normalized) return;
  const deduped = stats.networkBattlefield.filter((item) => item && item.hash !== normalized.hash);
  deduped.unshift(normalized);
  if (deduped.length > MAX_NETWORK_BATTLEFIELD) {
    deduped.length = MAX_NETWORK_BATTLEFIELD;
  }
  stats.networkBattlefield = deduped;
}

function sanitizeNetworkBattlefieldForRuntime(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seenHashes = new Set();
  for (let i = 0; i < input.length; i += 1) {
    if (out.length >= MAX_NETWORK_BATTLEFIELD) break;
    const entry = normalizeRuntimeBattlefieldEntry(input[i]);
    if (!entry || seenHashes.has(entry.hash)) continue;
    seenHashes.add(entry.hash);
    out.push(entry);
  }
  return out;
}

function normalizeRuntimeBattlefieldEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const hash = safeNormalizeHex(entry.hash);
  if (!hash) return null;
  const bits = safeNormalizeHex(entry.bits).padStart(8, "0");
  const coinbaseTagRaw = String(entry.coinbaseTagRaw || "0x").trim().slice(0, 128);
  const poolNameRaw = String(entry.poolName || "unknown").trim().slice(0, 96);
  const poolName = poolNameRaw && poolNameRaw.toLowerCase() !== "unknown"
    ? poolNameRaw
    : (derivePoolNameFromTag(coinbaseTagRaw) || "unknown");
  return {
    hash,
    height: Math.max(0, Math.floor(Number(entry.height) || 0)),
    timestamp: normalizeTimestampMs(entry.timestamp),
    bits,
    difficulty: Math.max(0, Number(entry.difficulty) || 0),
    coinbaseTxid: safeNormalizeHex(entry.coinbaseTxid) || "",
    coinbaseTagRaw,
    poolName,
    isOurPool: Boolean(entry.isOurPool)
  };
}

function normalizeCoinbaseScriptSigHex(rawTx) {
  if (!rawTx || typeof rawTx !== "object") return "";
  const vin = Array.isArray(rawTx.vin) ? rawTx.vin : [];
  if (!vin.length || !vin[0] || typeof vin[0] !== "object") return "";
  const firstVin = vin[0];
  return safeNormalizeHex(
    firstVin.coinbase
      || firstVin.coinbasestr
      || (firstVin.scriptSig && firstVin.scriptSig.hex)
      || ""
  );
}

function classifyCoinbaseAttribution(coinbaseScriptSigHex, poolTag) {
  const asciiSegments = extractAsciiSegmentsFromCoinbase(coinbaseScriptSigHex);
  const preferredSegment = pickPreferredCoinbaseTagSegment(asciiSegments);
  const tagRawDefault = coinbaseScriptSigHex
    ? ("0x" + coinbaseScriptSigHex.slice(0, 8))
    : "0x";
  const haystack = asciiSegments.join(" | ");
  const poolTagNeedle = normalizePoolTagNeedle(poolTag);

  if (poolTagNeedle && haystack.toLowerCase().includes(poolTagNeedle)) {
    const matchedSegment = findFirstMatchingSegment(asciiSegments, new RegExp(escapeRegExp(poolTagNeedle), "i"));
    return {
      poolName: "YOUR POOL",
      tagRaw: matchedSegment || tagRawDefault,
      isOurPool: true
    };
  }

  for (let i = 0; i < KNOWN_POOL_TAG_PATTERNS.length; i += 1) {
    const pattern = KNOWN_POOL_TAG_PATTERNS[i];
    const matchedSegment = findFirstMatchingSegment(asciiSegments, pattern.re);
    if (matchedSegment || pattern.re.test(haystack)) {
      return {
        poolName: pattern.name,
        tagRaw: matchedSegment || sanitizeTagRaw(haystack) || tagRawDefault,
        isOurPool: false
      };
    }
  }

  const fallbackTagRaw = sanitizeTagRaw(preferredSegment || asciiSegments[0]);
  const fallbackPoolName = derivePoolNameFromTag(fallbackTagRaw);
  return {
    poolName: fallbackPoolName || "unknown",
    tagRaw: fallbackTagRaw || tagRawDefault,
    isOurPool: false
  };
}

function extractAsciiSegmentsFromCoinbase(coinbaseScriptSigHex) {
  const clean = safeNormalizeHex(coinbaseScriptSigHex);
  if (!clean) return [];
  const buf = Buffer.from(clean, "hex");
  const out = [];
  let start = -1;
  for (let i = 0; i < buf.length; i += 1) {
    const b = buf[i];
    const printable = b >= 0x20 && b <= 0x7e;
    if (printable) {
      if (start === -1) start = i;
      continue;
    }
    if (start !== -1) {
      const segment = buf.slice(start, i).toString("utf8").trim();
      if (segment.length >= 3) out.push(segment.slice(0, 128));
      start = -1;
    }
  }
  if (start !== -1) {
    const tail = buf.slice(start).toString("utf8").trim();
    if (tail.length >= 3) out.push(tail.slice(0, 128));
  }
  return out;
}

function findFirstMatchingSegment(segments, pattern) {
  if (!Array.isArray(segments) || !pattern) return "";
  for (let i = 0; i < segments.length; i += 1) {
    const segment = String(segments[i] || "");
    if (pattern.test(segment)) return segment.slice(0, 128);
  }
  return "";
}

function sanitizeTagRaw(value) {
  const raw = String(value || "").trim();
  return raw ? raw.slice(0, 128) : "";
}

function pickPreferredCoinbaseTagSegment(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return "";
  let best = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < segments.length; i += 1) {
    const candidate = sanitizeTagRaw(segments[i]);
    if (!candidate) continue;
    const score = scoreCoinbaseTagSegment(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best || sanitizeTagRaw(segments[0]);
}

function scoreCoinbaseTagSegment(segment) {
  const s = String(segment || "").trim();
  if (!s) return Number.NEGATIVE_INFINITY;
  const lower = s.toLowerCase();
  let score = 0;

  if (/[a-z]/i.test(s)) score += 2;
  if (/[/-_ ]/.test(s)) score += 1;
  if (lower.includes("pool")) score += 4;
  if (lower.includes("mined")) score += 3;
  if (lower.includes("mining")) score += 3;
  if (lower.includes("miner")) score += 2;
  if (lower.includes("solo")) score += 2;
  if (lower.includes("hash")) score += 2;
  if (lower.includes("core")) score += 1;
  if (s.length >= 4 && s.length <= 32) score += 1;
  if (/^0x[0-9a-f]+$/i.test(s)) score -= 4;
  if (/^[a-z0-9]{7,12}$/i.test(s) && !lower.includes("pool") && !lower.includes("mine")) score -= 2;
  if (/^[1-9a-hj-np-z]{24,48}$/i.test(s)) score -= 3;

  return score;
}

function derivePoolNameFromTag(tagRaw) {
  const raw = String(tagRaw || "").trim();
  if (!raw || /^0x/i.test(raw)) return "";
  const cleaned = raw
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/^["']+/, "")
    .replace(/["']+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.slice(0, 96);
}

function normalizePoolTagNeedle(poolTag) {
  const raw = String(poolTag || "").trim();
  if (!raw) return "";
  return raw.toLowerCase();
}

function sanitizeRecentBlocksForRuntime(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seenHashes = new Set();
  for (let i = 0; i < input.length; i += 1) {
    if (out.length >= MAX_RECENT_BLOCKS) break;
    const entry = normalizeRuntimeBlockEntry(input[i]);
    if (!entry || seenHashes.has(entry.hash)) continue;
    seenHashes.add(entry.hash);
    out.push(entry);
  }
  return out;
}

function normalizeRuntimeBlockEntry(block) {
  if (!block || typeof block !== "object") return null;
  const hash = safeNormalizeHex(block.hash);
  if (!hash) return null;

  const workerRaw = String(block.worker || "").trim();
  const worker = workerRaw === "" ? "unknown" : workerRaw.slice(0, 96);
  const coinbaseTxid = safeNormalizeHex(block.coinbaseTxid);
  const status = normalizeBlockStatus(block.status);
  return {
    hash,
    height: Math.max(0, Math.floor(Number(block.height) || 0)),
    worker,
    timestamp: Math.max(0, Math.floor(Number(block.timestamp) || 0)),
    status,
    confirmations: Math.max(0, Math.floor(Number(block.confirmations) || 0)),
    coinbaseTxid: coinbaseTxid || "",
    rewardSats: Math.max(0, Math.floor(Number(block.rewardSats) || 0)),
    lastCheckedAt: Math.max(0, Math.floor(Number(block.lastCheckedAt) || 0))
  };
}

function initializeTotalRewardSats(stats) {
  if (!stats || typeof stats !== "object") return 0;
  const current = Math.max(0, Math.floor(Number(stats.totalRewardSats) || 0));
  if (current > 0) return current;
  const blocks = sanitizeRecentBlocksForRuntime(stats.recentBlocks);
  let seeded = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.status === BLOCK_STATUS_ORPHANED) continue;
    seeded += Math.max(0, Math.floor(Number(block.rewardSats) || 0));
  }
  return seeded;
}

function sanitizeRecentDifficultySamplesForRuntime(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (let i = 0; i < input.length; i += 1) {
    const sample = input[i];
    if (!sample || typeof sample !== "object") continue;
    const bits = safeNormalizeHex(sample.bits);
    if (!bits) continue;

    const difficultyRaw = Number(sample.difficulty);
    const difficulty = (Number.isFinite(difficultyRaw) && difficultyRaw > 0)
      ? difficultyRaw
      : compactBitsToDifficulty(bits);
    if (!Number.isFinite(difficulty) || difficulty <= 0) continue;

    out.push({
      t: Math.max(0, Math.floor(Number(sample.t) || 0)),
      height: Math.max(0, Math.floor(Number(sample.height) || 0)),
      bits,
      difficulty
    });
  }
  return out.length > MAX_DIFFICULTY_SAMPLES ? out.slice(-MAX_DIFFICULTY_SAMPLES) : out;
}

function applyDifficultyObservatoryStats(stats, samplesInput) {
  if (!stats || typeof stats !== "object") return;
  const samples = sanitizeRecentDifficultySamplesForRuntime(samplesInput);
  stats.recentDifficultySamples = samples;
  if (samples.length === 0) {
    stats.currentDifficulty = 0;
    stats.currentDifficultyBits = null;
    stats.currentDifficultyHeight = 0;
    stats.difficultyTrend = "flat";
    stats.difficultyTrendChangePct = 0;
    stats.difficultyTrendWindow = 0;
    stats.difficultyLastUpdateAt = 0;
    return;
  }

  const current = samples[samples.length - 1];
  stats.currentDifficulty = current.difficulty;
  stats.currentDifficultyBits = current.bits;
  stats.currentDifficultyHeight = current.height;
  stats.difficultyLastUpdateAt = current.t;

  const windowSize = Math.max(2, Math.min(DIFFICULTY_TREND_WINDOW, samples.length));
  const baseline = samples[samples.length - windowSize];
  const baselineDiff = Number(baseline && baseline.difficulty ? baseline.difficulty : 0);
  const currentDiff = Number(current.difficulty || 0);
  const changePct = baselineDiff > 0
    ? ((currentDiff - baselineDiff) / baselineDiff) * 100
    : 0;
  stats.difficultyTrendWindow = windowSize;
  stats.difficultyTrendChangePct = Math.round(changePct * 100) / 100;
  stats.difficultyTrend = classifyDifficultyTrend(changePct);
}

function classifyDifficultyTrend(changePct) {
  if (changePct > DIFFICULTY_TREND_EPSILON_PCT) return "rising";
  if (changePct < -DIFFICULTY_TREND_EPSILON_PCT) return "falling";
  return "flat";
}

function normalizeBlockStatus(status) {
  if (status === BLOCK_STATUS_CONFIRMED) return BLOCK_STATUS_CONFIRMED;
  if (status === BLOCK_STATUS_ORPHANED) return BLOCK_STATUS_ORPHANED;
  return BLOCK_STATUS_PENDING;
}

function safeNormalizeHex(value) {
  try {
    return normalizeHex(String(value || ""));
  } catch (_err) {
    return "";
  }
}

function normalizeTimestampMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 1e12) return Math.floor(n);
  if (n > 1e9) return Math.floor(n * 1000);
  if (n > 1e6) return Math.floor(n);
  return 0;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRpcNotFoundError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  return msg.includes("\"code\":-5")
    || msg.includes("Block not found")
    || msg.includes("Block hash not found");
}

function isRpcHeightOutOfRangeError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  return msg.includes("Block height out of range")
    || msg.includes("\"code\":-8");
}

module.exports = { JobManager };
