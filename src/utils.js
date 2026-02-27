"use strict";

const crypto = require("node:crypto");

const DIFF1_TARGET = BigInt(
  "0x00000000FFFF0000000000000000000000000000000000000000000000000000"
);

function toBool(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const v = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultValue;
}

function toInt(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function toFloat(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizeHex(hex) {
  if (typeof hex !== "string") throw new Error("hex must be a string");
  let value = hex.trim().toLowerCase();
  if (value.startsWith("0x")) value = value.slice(2);
  if (value.length % 2 !== 0) value = "0" + value;
  if (!/^[0-9a-f]*$/.test(value)) throw new Error("invalid hex");
  return value;
}

function hexToBuffer(hex) {
  return Buffer.from(normalizeHex(hex), "hex");
}

function reverseBuffer(buf) {
  const out = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i < buf.length; i += 1) {
    out[i] = buf[buf.length - 1 - i];
  }
  return out;
}

function reverseHex(hex) {
  return reverseBuffer(hexToBuffer(hex)).toString("hex");
}

function swap32Hex(hex) {
  const buf = hexToBuffer(hex);
  if (buf.length % 4 !== 0) {
    throw new Error("swap32Hex requires byte length multiple of 4");
  }
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i];
    buf[i] = buf[i + 3];
    buf[i + 3] = a;
    const b = buf[i + 1];
    buf[i + 1] = buf[i + 2];
    buf[i + 2] = b;
  }
  return buf.toString("hex");
}

function uint32LEBuffer(value) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return buf;
}

function uint64LEBuffer(value) {
  let n = BigInt(value);
  const buf = Buffer.alloc(8);
  for (let i = 0; i < 8; i += 1) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

function varIntBuffer(value) {
  const n = typeof value === "bigint" ? value : BigInt(value);
  if (n < 0xfdn) return Buffer.from([Number(n)]);
  if (n <= 0xffffn) {
    const b = Buffer.allocUnsafe(3);
    b[0] = 0xfd;
    b.writeUInt16LE(Number(n), 1);
    return b;
  }
  if (n <= 0xffffffffn) {
    return Buffer.concat([Buffer.from([0xfe]), uint32LEBuffer(Number(n))]);
  }
  return Buffer.concat([Buffer.from([0xff]), uint64LEBuffer(n)]);
}

function encodeScriptNumLE(value) {
  let n = BigInt(value);
  if (n === 0n) return Buffer.alloc(0);
  const negative = n < 0n;
  if (negative) n = -n;

  const bytes = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }

  if (bytes[bytes.length - 1] & 0x80) {
    bytes.push(negative ? 0x80 : 0x00);
  } else if (negative) {
    bytes[bytes.length - 1] |= 0x80;
  }

  return Buffer.from(bytes);
}

function bip34HeightPush(height) {
  const scriptNum = encodeScriptNumLE(height);
  if (scriptNum.length > 75) {
    throw new Error("unexpected BIP34 height size");
  }
  return Buffer.concat([Buffer.from([scriptNum.length]), scriptNum]);
}

function doubleSha256(buffer) {
  const a = crypto.createHash("sha256").update(buffer).digest();
  return crypto.createHash("sha256").update(a).digest();
}

function compactBitsToTarget(bitsHex) {
  const bits = normalizeHex(bitsHex).padStart(8, "0");
  const exponent = Number.parseInt(bits.slice(0, 2), 16);
  const mantissa = BigInt("0x" + bits.slice(2));
  if (exponent <= 3) {
    return mantissa >> BigInt(8 * (3 - exponent));
  }
  return mantissa << BigInt(8 * (exponent - 3));
}

function parseDecimalToFraction(input) {
  const str = String(input).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error("difficulty must be a positive decimal");
  }
  if (!str.includes(".")) {
    const n = BigInt(str);
    if (n <= 0n) throw new Error("difficulty must be > 0");
    return { numerator: n, denominator: 1n };
  }
  const [whole, frac] = str.split(".");
  const denominator = 10n ** BigInt(frac.length);
  const numerator = BigInt(whole + frac);
  if (numerator <= 0n) throw new Error("difficulty must be > 0");
  return { numerator, denominator };
}

function difficultyToTarget(difficulty) {
  const { numerator, denominator } = parseDecimalToFraction(difficulty);
  return (DIFF1_TARGET * denominator) / numerator;
}

function bufferToBigIntLE(buffer) {
  let result = 0n;
  for (let i = buffer.length - 1; i >= 0; i -= 1) {
    result = (result << 8n) | BigInt(buffer[i]);
  }
  return result;
}

function toFixedHexU32(value) {
  const n = Number(value) >>> 0;
  return n.toString(16).padStart(8, "0");
}

function safeJsonParse(line) {
  try {
    return { ok: true, value: JSON.parse(line) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function nowMs() {
  return Date.now();
}

function formatPrevhashForStratum(previousBlockHashHex, mode) {
  const rpcOrder = normalizeHex(previousBlockHashHex);
  const headerOrder = reverseHex(rpcOrder);
  switch (mode) {
    case "header":
      return headerOrder;
    case "rpc":
      return rpcOrder;
    case "stratum_wordrev":
      // Alternate legacy convention: reverse 32-bit word order from header-order bytes.
      return swap32Hex(headerOrder);
    case "stratum":
    default:
      // Standard Stratum V1 prevhash formatting is 32-bit word-swapped RPC hash.
      return swap32Hex(rpcOrder);
  }
}

function splitRulesCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePasswordKv(password) {
  const out = {};
  if (!password) return out;
  const parts = String(password).split(/[;,]/);
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (!k || v === undefined) continue;
    out[k.trim().toLowerCase()] = v.trim();
  }
  return out;
}

module.exports = {
  DIFF1_TARGET,
  toBool,
  toInt,
  toFloat,
  normalizeHex,
  hexToBuffer,
  reverseBuffer,
  reverseHex,
  swap32Hex,
  uint32LEBuffer,
  uint64LEBuffer,
  varIntBuffer,
  bip34HeightPush,
  doubleSha256,
  compactBitsToTarget,
  difficultyToTarget,
  bufferToBigIntLE,
  toFixedHexU32,
  safeJsonParse,
  nowMs,
  formatPrevhashForStratum,
  splitRulesCsv,
  parsePasswordKv
};
