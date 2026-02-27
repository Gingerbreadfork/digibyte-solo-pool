"use strict";

const { doubleSha256 } = require("./utils");

/**
 * Builds merkle branches for coinbase transaction from transaction ID leaves.
 * The coinbase (first transaction) is represented as null in the tree.
 *
 * @param {Buffer[]} txidLeaves - Array of transaction ID buffers (not including coinbase)
 * @returns {Buffer[]} Array of merkle branch hashes
 */
function buildCoinbaseMerkleBranches(txidLeaves) {
  if (!txidLeaves.length) {
    return [];
  }

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

/**
 * Computes merkle root from coinbase hash and branch hashes.
 *
 * @param {Buffer} coinbaseHashRaw - Coinbase transaction hash
 * @param {Buffer[]|string[]} branchHexes - Array of merkle branch hashes (Buffer or hex string)
 * @returns {Buffer} Merkle root hash
 */
function computeMerkleRootFromBranches(coinbaseHashRaw, branchHexes) {
  let hash = coinbaseHashRaw;
  for (const branchHex of branchHexes) {
    const branch = Buffer.isBuffer(branchHex) ? branchHex : Buffer.from(branchHex, "hex");
    hash = doubleSha256(Buffer.concat([hash, branch]));
  }
  return hash;
}

module.exports = {
  buildCoinbaseMerkleBranches,
  computeMerkleRootFromBranches
};
