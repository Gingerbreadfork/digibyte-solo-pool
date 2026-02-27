"use strict";

const {
  normalizeHex,
  varIntBuffer,
  bip34HeightPush,
  uint64LEBuffer
} = require("./utils");

/**
 * Builds the coinbase transaction pieces for a mining job.
 * Returns separate pieces for merkle root calculation and block assembly.
 *
 * @param {Object} params
 * @param {Object} params.template - Block template from getblocktemplate
 * @param {string} params.payoutScriptHex - Hex-encoded payout scriptPubKey
 * @param {string} params.poolTag - Pool identification tag in coinbase
 * @param {number} params.extranonce1Size - Size of extranonce1 in bytes
 * @param {number} params.extranonce2Size - Size of extranonce2 in bytes
 * @param {string} params.segwitCommitmentScript - SegWit commitment script (if applicable)
 * @returns {Object} Coinbase pieces for merkle and block assembly
 */
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

module.exports = { buildCoinbasePieces };
