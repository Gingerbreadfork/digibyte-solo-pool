"use strict";

const {
  doubleSha256,
  bufferToBigIntLE,
  DIFF1_TARGET
} = require("./utils");
const { computeMerkleRootFromBranches } = require("./merkle");
const { buildBlockHeader, resolveShareVersionHex } = require("./share-crypto");

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
