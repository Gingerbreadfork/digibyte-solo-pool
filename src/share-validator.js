"use strict";

const {
  normalizeHex,
  doubleSha256,
  bufferToBigIntLE,
  DIFF1_TARGET,
  uint32LEBuffer,
  toFixedHexU32
} = require("./utils");
const { computeMerkleRootFromBranches } = require("./merkle");

/**
 * Builds a block header from components.
 *
 * @param {Object} params
 * @param {string} params.versionHex - Version as hex string
 * @param {Buffer} params.prevhashRaw - Previous block hash (header order)
 * @param {Buffer} params.merkleRootRaw - Merkle root
 * @param {string} params.ntimeHex - Block time as hex string
 * @param {string} params.bitsHex - Difficulty bits as hex string
 * @param {string} params.nonceHex - Nonce as hex string
 * @returns {Buffer} Block header (80 bytes)
 */
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

/**
 * Resolves the version hex for a share, considering version rolling.
 *
 * @param {Object} params
 * @param {string} params.baseVersionHex - Base version from job
 * @param {string} params.versionBitsHex - Version bits from miner (if version rolling enabled)
 * @param {boolean} params.versionRollingEnabled - Whether version rolling is enabled
 * @param {string} params.versionRollingMaskHex - Negotiated version rolling mask
 * @returns {Object} { ok: boolean, versionHex: string, versionBitsHex: string|null, message: string }
 */
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

/**
 * Validates a share submission and returns validation result.
 *
 * @param {Object} params - Share submission parameters
 * @param {Object} params.job - Mining job
 * @param {Object} params.client - Miner client
 * @param {Buffer} params.extranonce2Buf - Extranonce2 buffer
 * @param {string} params.ntimeHex - Time
 * @param {string} params.nonceHex - Nonce
 * @param {string} params.versionBitsHex - Version bits (optional)
 * @param {string} params.workerName - Worker name
 * @returns {Object} Validation result
 */
function validateShare(params) {
  const { job, client, extranonce2Buf, ntimeHex, nonceHex, versionBitsHex, workerName } = params;

  const versionResolution = resolveShareVersionHex({
    baseVersionHex: job.versionHex,
    versionBitsHex,
    versionRollingEnabled: Boolean(client.versionRollingEnabled),
    versionRollingMaskHex: client.versionRollingMaskHex || "00000000"
  });

  if (!versionResolution.ok) {
    return { ok: false, code: "invalid", message: versionResolution.message };
  }

  const coinbaseRaw = Buffer.concat([
    job.coinbase1Raw,
    client.extranonce1Raw || Buffer.from(client.extranonce1Hex, "hex"),
    extranonce2Buf,
    job.coinbase2Raw
  ]);

  const coinbaseHash = doubleSha256(coinbaseRaw);
  const merkleRoot = computeMerkleRootFromBranches(coinbaseHash, job.merkleBranchesRaw);
  const header = buildBlockHeader({
    versionHex: versionResolution.versionHex,
    prevhashRaw: job.prevhashHeaderRaw,
    merkleRootRaw: merkleRoot,
    ntimeHex,
    bitsHex: job.bitsHex,
    nonceHex
  });

  const headerHash = doubleSha256(header);
  const headerHashInt = bufferToBigIntLE(headerHash);
  const shareDifficulty = headerHashInt > 0n
    ? (DIFF1_TARGET / headerHashInt)
    : 0n;

  const shareTarget = (typeof client.shareTarget === "bigint" && client.shareTarget > 0n)
    ? client.shareTarget
    : DIFF1_TARGET;

  if (headerHashInt > shareTarget) {
    return {
      ok: false,
      code: "lowdiff",
      message: "Low difficulty share",
      shareDifficulty: shareDifficulty.toString(),
      shareHashHex: Buffer.from(headerHash).reverse().toString("hex")
    };
  }

  const shareHashHex = Buffer.from(headerHash).reverse().toString("hex");
  return {
    ok: true,
    isBlockCandidate: headerHashInt <= job.networkTarget,
    shareHashHex,
    headerHashInt,
    shareDifficulty: shareDifficulty.toString(),
    assignedDifficulty: client.difficulty,
    versionHex: versionResolution.versionHex,
    versionBitsHex: versionResolution.versionBitsHex,
    coinbaseRaw,
    merkleRootRaw: merkleRoot,
    headerRaw: header,
    workerName
  };
}

module.exports = {
  buildBlockHeader,
  resolveShareVersionHex,
  validateShare
};
