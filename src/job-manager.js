"use strict";

const EventEmitter = require("node:events");
const {
  DIFF1_TARGET,
  normalizeHex,
  hexToBuffer,
  reverseHex,
  varIntBuffer,
  bip34HeightPush,
  uint64LEBuffer,
  compactBitsToTarget,
  difficultyToTarget,
  doubleSha256,
  bufferToBigIntLE,
  uint32LEBuffer,
  toFixedHexU32,
  nowMs,
  formatPrevhashForStratum
} = require("./utils");

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
    this.prevhashEpochSeq = 0;
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
    if (this.config.enableLongpoll) {
      this.startLongpollLoop();
    }
  }

  async stop() {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  schedulePoll() {
    if (!this.running) return;
    const delayMs = this.nextPollDelayMs();
    this.pollTimer = setTimeout(async () => {
      try {
        await this.refreshTemplate("poll");
      } catch (err) {
        this.logger.warn("Template poll failed", { error: err.message });
      } finally {
        this.schedulePoll();
      }
    }, delayMs);
    this.pollTimer.unref?.();
  }

  startLongpollLoop() {
    const loop = async () => {
      while (this.running) {
        try {
          // Don't measure longpoll latency - it's a blocking wait for new blocks (can be 30+ seconds)
          const tpl = await this.rpc.getBlockTemplate(this.longpollId);
          this.lastLongpollSuccessAt = nowMs();
          this.handleTemplate(tpl, "longpoll");
        } catch (err) {
          this.logger.warn("Longpoll getblocktemplate failed", { error: err.message });
          await sleep(1000);
        }
      }
    };
    this.longpollPromise = loop();
  }

  nextPollDelayMs() {
    const baseMs = Math.max(250, Number(this.config.templatePollMs || 1000));
    if (!this.config.enableLongpoll) return baseMs;

    const healthyPollMs = Math.max(baseMs, Number(this.config.templatePollMsLongpollHealthy || baseMs));
    const graceMs = Math.max(1000, Number(this.config.longpollHealthyGraceMs || 120000));
    const lastSuccessAt = Number(this.lastLongpollSuccessAt || 0);
    if (lastSuccessAt > 0 && (nowMs() - lastSuccessAt) <= graceMs) {
      return healthyPollMs;
    }
    return baseMs;
  }

  async refreshTemplate(source) {
    // Measure actual RPC latency (not longpoll which blocks waiting for new blocks)
    const startTime = nowMs();
    const tpl = await this.rpc.getBlockTemplate(null);
    const fetchMs = nowMs() - startTime;
    this.recordTemplateFetchLatency(fetchMs);
    this.handleTemplate(tpl, source);
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

    const fingerprint = buildTemplateFingerprint(template, this.config.templateFingerprintMode);

    if (fingerprint === this.lastTemplateFingerprint && source !== "startup") {
      return;
    }
    this.lastTemplateFingerprint = fingerprint;

    const isNewPrev = !this.currentJob ||
      this.currentJob.template.previousblockhash !== template.previousblockhash;
    const prevhashEpoch = isNewPrev
      ? (++this.prevhashEpochSeq)
      : (this.currentJob ? this.currentJob.prevhashEpoch : Math.max(1, this.prevhashEpochSeq));
    const job = this.buildJobFromTemplate(template, isNewPrev, prevhashEpoch);
    this.currentJob = job;
    this.jobs.set(job.jobId, job);
    this.pruneOldJobs();

    this.stats.currentHeight = template.height || 0;
    this.stats.lastTemplateAt = Date.now();
    this.stats.lastTemplateSource = source;
    this.stats.currentNetworkBits = template.bits || null;

    this.emit("job", job);

    this.logger.info("New mining job", {
      source,
      jobId: job.jobId,
      height: template.height,
      txCount: 1 + job.transactions.length,
      cleanJobs: isNewPrev,
      segwit: job.segwit
    });
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

  buildJobFromTemplate(template, cleanJobs, prevhashEpoch) {
    const txs = Array.isArray(template.transactions) ? template.transactions : [];
    const segwitCommitmentScript = template.default_witness_commitment
      ? normalizeHex(template.default_witness_commitment)
      : "";

    const coinbasePieces = buildCoinbasePieces({
      template,
      payoutScriptHex: this.payoutScriptHex,
      poolTag: this.config.poolTag,
      extranonce1Size: this.config.extranonce1Size,
      extranonce2Size: this.config.extranonce2Size,
      segwitCommitmentScript
    });

    const txidLeaves = txs.map((tx) => {
      const txidHex = tx.txid || tx.hash;
      if (!txidHex) throw new Error("GBT transaction missing txid/hash");
      return Buffer.from(reverseHex(txidHex), "hex");
    });

    const merkleBranchesRaw = buildCoinbaseMerkleBranches(txidLeaves);
    const merkleBranchesHex = merkleBranchesRaw.map((b) => b.toString("hex"));

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
      this.stats.lastFoundBlockHash = shareResult.shareHashHex;
      this.stats.lastFoundBlockAt = Date.now();
      this.logger.info("Block candidate accepted by node", {
        blockHash: shareResult.shareHashHex,
        height: job.template.height,
        worker: shareResult.workerName
      });
      this.emit("blockAccepted", {
        blockHash: shareResult.shareHashHex,
        height: job.template.height,
        workerName: shareResult.workerName
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

function buildCoinbasePieces({
  template,
  payoutScriptHex,
  poolTag,
  extranonce1Size,
  extranonce2Size,
  segwitCommitmentScript
}) {
  const version = Buffer.from("01000000", "hex");
  const markerFlag = Buffer.from("0001", "hex");
  const inputCount = Buffer.from([0x01]);
  const prevoutHash = Buffer.alloc(32, 0);
  const prevoutIndex = Buffer.from("ffffffff", "hex");
  const heightPush = bip34HeightPush(template.height || 0);
  const coinbaseAuxFlags = template.coinbaseaux && template.coinbaseaux.flags
    ? Buffer.from(normalizeHex(template.coinbaseaux.flags), "hex")
    : Buffer.alloc(0);
  const poolTagBuf = Buffer.from(String(poolTag), "utf8");
  const scriptPrefix = Buffer.concat([heightPush, coinbaseAuxFlags, poolTagBuf]);

  const totalScriptLen = scriptPrefix.length + extranonce1Size + extranonce2Size;
  if (totalScriptLen > 100) {
    throw new Error(`coinbase scriptSig too large (${totalScriptLen} > 100)`);
  }
  const scriptLen = varIntBuffer(totalScriptLen);
  const sequence = Buffer.from("ffffffff", "hex");

  const outputs = [];
  const payoutScript = Buffer.from(normalizeHex(payoutScriptHex), "hex");
  outputs.push(Buffer.concat([
    uint64LEBuffer(BigInt(template.coinbasevalue)),
    varIntBuffer(payoutScript.length),
    payoutScript
  ]));

  if (segwitCommitmentScript) {
    const commitmentScript = Buffer.from(segwitCommitmentScript, "hex");
    outputs.push(Buffer.concat([
      uint64LEBuffer(0n),
      varIntBuffer(commitmentScript.length),
      commitmentScript
    ]));
  }

  const outputsBlob = Buffer.concat([
    varIntBuffer(outputs.length),
    ...outputs
  ]);

  const locktime = Buffer.alloc(4, 0);

  const witnessSection = segwitCommitmentScript
    ? Buffer.concat([Buffer.from([0x01, 0x20]), Buffer.alloc(32, 0)])
    : Buffer.alloc(0);

  const baseInputPrefix = Buffer.concat([
    inputCount,
    prevoutHash,
    prevoutIndex,
    scriptLen,
    scriptPrefix
  ]);

  const baseInputSuffix = sequence;

  const merkleCoinbase1 = Buffer.concat([version, baseInputPrefix]);
  const merkleCoinbase2 = Buffer.concat([baseInputSuffix, outputsBlob, locktime]);

  const blockCoinbase1 = segwitCommitmentScript
    ? Buffer.concat([version, markerFlag, baseInputPrefix])
    : merkleCoinbase1;
  const blockCoinbase2 = segwitCommitmentScript
    ? Buffer.concat([baseInputSuffix, outputsBlob, witnessSection, locktime])
    : merkleCoinbase2;

  return {
    merkleCoinbase1Hex: merkleCoinbase1.toString("hex"),
    merkleCoinbase1Raw: merkleCoinbase1,
    merkleCoinbase2Hex: merkleCoinbase2.toString("hex"),
    merkleCoinbase2Raw: merkleCoinbase2,
    blockCoinbase1Hex: blockCoinbase1.toString("hex"),
    blockCoinbase2Hex: blockCoinbase2.toString("hex")
  };
}

function buildCoinbaseMerkleBranches(txidLeaves) {
  if (!txidLeaves.length) return [];

  let layer = [null, ...txidLeaves];
  const branches = [];

  while (layer.length > 1) {
    if (layer.length % 2 === 1) {
      layer.push(layer[layer.length - 1]);
    }

    if (layer[0] === null) {
      if (!Buffer.isBuffer(layer[1])) {
        throw new Error("Invalid merkle construction: missing sibling for coinbase");
      }
      branches.push(layer[1]);
    } else {
      throw new Error("Merkle placeholder was not preserved");
    }

    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1];
      if (left === null || right === null) {
        next.push(null);
      } else {
        next.push(doubleSha256(Buffer.concat([left, right])));
      }
    }
    layer = next;
  }

  return branches;
}

function computeMerkleRootFromBranches(coinbaseHashRaw, branchHexes) {
  let hash = coinbaseHashRaw;
  for (const branchHex of branchHexes) {
    const branch = Buffer.isBuffer(branchHex) ? branchHex : Buffer.from(branchHex, "hex");
    hash = doubleSha256(Buffer.concat([hash, branch]));
  }
  return hash;
}

function buildBlockHeader({ versionHex, prevhashRaw, merkleRootRaw, ntimeHex, bitsHex, nonceHex }) {
  const versionLe = uint32LEBuffer(Number.parseInt(versionHex, 16));
  const timeLe = uint32LEBuffer(Number.parseInt(ntimeHex, 16));
  const bitsLe = Buffer.from(normalizeHex(bitsHex), "hex").reverse();
  const nonceLe = Buffer.from(normalizeHex(nonceHex), "hex").reverse();

  return Buffer.concat([
    versionLe,
    prevhashRaw,
    merkleRootRaw,
    timeLe,
    bitsLe,
    nonceLe
  ]);
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

function resolveShareVersionHex({
  baseVersionHex,
  versionBitsHex,
  versionRollingEnabled,
  versionRollingMaskHex
}) {
  const baseHex = normalizeHex(baseVersionHex).padStart(8, "0");
  if (baseHex.length !== 8) {
    return { ok: false, message: "Invalid job version" };
  }

  if (!versionRollingEnabled) {
    return { ok: true, versionHex: baseHex, versionBitsHex: null };
  }

  const maskHex = normalizeHex(versionRollingMaskHex || "00000000").padStart(8, "0");
  if (maskHex.length !== 8) {
    return { ok: false, message: "Invalid version rolling mask" };
  }

  if (versionBitsHex === undefined || versionBitsHex === null || String(versionBitsHex) === "") {
    return { ok: false, message: "Missing version rolling bits in submit" };
  }

  const bitsHex = normalizeHex(String(versionBitsHex)).padStart(8, "0");
  if (bitsHex.length !== 8) {
    return { ok: false, message: "version rolling bits must be 4-byte hex" };
  }

  const baseVersion = Number.parseInt(baseHex, 16) >>> 0;
  const mask = Number.parseInt(maskHex, 16) >>> 0;
  const bits = Number.parseInt(bitsHex, 16) >>> 0;
  const disallowed = (bits & (~mask >>> 0)) >>> 0;
  if (disallowed !== 0) {
    return { ok: false, message: "version rolling bits outside negotiated mask" };
  }

  const version = ((baseVersion & (~mask >>> 0)) | (bits & mask)) >>> 0;
  return {
    ok: true,
    versionHex: toFixedHexU32(version),
    versionBitsHex: bitsHex
  };
}

function reject(code, message, extra) {
  return Object.assign({ ok: false, code, message }, extra || {});
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

module.exports = { JobManager };
