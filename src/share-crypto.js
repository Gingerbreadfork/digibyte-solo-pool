"use strict";

const {
  normalizeHex,
  uint32LEBuffer,
  toFixedHexU32
} = require("./utils");

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
 * Accepts both masked-bits form and full 32-bit submissions with fixed bits included.
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
    return { ok: true, versionHex: baseHex, versionBitsHex: null };
  }

  const bitsHex = normalizeHex(String(versionBitsHex)).padStart(8, "0");
  if (bitsHex.length !== 8) {
    return { ok: false, message: "version rolling bits must be 4-byte hex" };
  }

  const baseVersion = Number.parseInt(baseHex, 16) >>> 0;
  const mask = Number.parseInt(maskHex, 16) >>> 0;
  const bits = Number.parseInt(bitsHex, 16) >>> 0;
  const baseFixedBits = (baseVersion & (~mask >>> 0)) >>> 0;
  const submittedFixedBits = (bits & (~mask >>> 0)) >>> 0;

  if (submittedFixedBits !== 0 && submittedFixedBits !== baseFixedBits) {
    return { ok: false, message: "version rolling bits outside negotiated mask" };
  }

  const version = (baseFixedBits | (bits & mask)) >>> 0;
  return {
    ok: true,
    versionHex: toFixedHexU32(version),
    versionBitsHex: bitsHex
  };
}

module.exports = {
  buildBlockHeader,
  resolveShareVersionHex
};
