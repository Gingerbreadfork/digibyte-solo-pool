"use strict";

const EventEmitter = require("node:events");
const net = require("node:net");
const { nowMs } = require("./utils");

const ZMTP_GREETING_SIZE = 64;
const ZMTP_FLAG_MORE = 0x01;
const ZMTP_FLAG_LONG = 0x02;
const ZMTP_FLAG_COMMAND = 0x04;
const ZMTP_MAX_FRAME_BYTES = 8 * 1024 * 1024;

class ZmqHashblockSubscriber extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.endpoint = String(config.zmqHashblockEndpoint || "").trim();
    const parsed = parseTcpEndpoint(this.endpoint);
    this.host = parsed.host;
    this.port = parsed.port;

    this.topic = "hashblock";
    this.running = false;
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectStreak = 0;
    this.baseReconnectMs = Math.max(50, Number(config.zmqReconnectBaseMs || 250));
    this.maxReconnectMs = Math.max(
      this.baseReconnectMs,
      Number(config.zmqReconnectMaxMs || 10000)
    );

    this.recvBuffer = Buffer.alloc(0);
    this.messageParts = [];
    this.peerGreetingDone = false;
    this.clientReadySent = false;
    this.serverReady = false;
    this.subscribed = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
    this.resetSessionState();
  }

  connect() {
    if (!this.running) return;
    this.closeSocket();
    this.resetSessionState();

    const socket = net.createConnection({
      host: this.host,
      port: this.port
    });
    this.socket = socket;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 1000);

    socket.on("connect", () => {
      this.reconnectStreak = 0;
      this.logger.info("Connected to ZMQ publisher", {
        endpoint: this.endpoint,
        topic: this.topic
      });
      this.emit("connected", { endpoint: this.endpoint });
      this.sendGreeting();
    });

    socket.on("data", (chunk) => this.onData(chunk));

    socket.on("error", (err) => {
      if (!this.running) return;
      this.logger.warn("ZMQ socket error", {
        endpoint: this.endpoint,
        error: err.message
      });
    });

    socket.on("close", () => {
      if (!this.running) return;
      this.emit("disconnected", { endpoint: this.endpoint });
      this.scheduleReconnect();
    });
  }

  onData(chunk) {
    if (!this.running || !this.socket) return;
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) return;

    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);
    try {
      while (true) {
        if (!this.peerGreetingDone) {
          if (this.recvBuffer.length < ZMTP_GREETING_SIZE) return;
          const greeting = this.consumeBytes(ZMTP_GREETING_SIZE);
          if (!isValidGreeting(greeting)) {
            this.logger.warn("Invalid ZMQ greeting from peer", { endpoint: this.endpoint });
            this.socket.destroy(new Error("Invalid ZMQ greeting"));
            return;
          }
          this.peerGreetingDone = true;
          if (!this.clientReadySent) {
            this.sendReady();
            this.clientReadySent = true;
          }
          continue;
        }

        const frame = this.tryReadFrame();
        if (!frame) return;

        if (frame.command) {
          this.handleCommandFrame(frame.body);
          continue;
        }

        if (!this.serverReady) {
          continue;
        }
        this.handleMessageFrame(frame.body, frame.more);
      }
    } catch (err) {
      this.logger.warn("ZMQ frame processing error", {
        endpoint: this.endpoint,
        error: err.message
      });
      this.socket.destroy(err);
    }
  }

  handleCommandFrame(frameBody) {
    const command = parseCommandFrame(frameBody);
    if (!command) {
      this.logger.warn("Malformed ZMQ command frame", { endpoint: this.endpoint });
      return;
    }

    if (command.name === "READY") {
      this.serverReady = true;
      if (!this.subscribed) {
        this.sendSubscribe();
      }
      return;
    }

    if (command.name === "PING") {
      this.sendCommand("PONG", command.data);
      return;
    }

    if (command.name === "ERROR") {
      this.logger.warn("ZMQ peer reported ERROR", {
        endpoint: this.endpoint,
        details: command.data.toString("utf8")
      });
    }
  }

  handleMessageFrame(frameBody, more) {
    this.messageParts.push(frameBody);
    if (more) return;

    const parts = this.messageParts;
    this.messageParts = [];
    this.processMessage(parts);
  }

  processMessage(parts) {
    if (!Array.isArray(parts) || parts.length < 2) return;
    const topic = parts[0].toString("utf8");
    if (topic !== this.topic) return;

    const hashRaw = parts[1];
    if (!Buffer.isBuffer(hashRaw) || hashRaw.length !== 32) {
      this.logger.warn("Ignoring malformed hashblock payload", {
        endpoint: this.endpoint,
        payloadBytes: Buffer.isBuffer(hashRaw) ? hashRaw.length : -1
      });
      return;
    }

    const sequence = parts.length >= 3 && parts[2].length >= 4
      ? parts[2].readUInt32LE(0)
      : null;
    const blockHashHex = Buffer.from(hashRaw).reverse().toString("hex");

    this.emit("hashblock", {
      topic,
      blockHashHex,
      sequence,
      receivedAt: nowMs()
    });
  }

  sendGreeting() {
    this.writeRaw(buildGreetingFrame());
  }

  sendReady() {
    const properties = Buffer.concat([
      encodeMetadataProperty("Socket-Type", Buffer.from("SUB", "utf8"))
    ]);
    this.sendCommand("READY", properties);
  }

  sendSubscribe() {
    this.sendCommand("SUBSCRIBE", Buffer.from(this.topic, "utf8"));
    this.subscribed = true;
    this.logger.info("Subscribed to ZMQ hashblock notifications", {
      endpoint: this.endpoint,
      topic: this.topic
    });
  }

  sendCommand(name, data) {
    const commandName = Buffer.from(String(name || ""), "utf8");
    if (commandName.length <= 0 || commandName.length > 255) {
      throw new Error("Invalid ZMQ command name length");
    }
    const payload = Buffer.concat([
      Buffer.from([commandName.length]),
      commandName,
      Buffer.isBuffer(data) ? data : Buffer.alloc(0)
    ]);
    this.writeRaw(encodeFrame(ZMTP_FLAG_COMMAND, payload));
  }

  writeRaw(buf) {
    if (!this.running || !this.socket) return;
    this.socket.write(buf);
  }

  tryReadFrame() {
    if (this.recvBuffer.length < 2) return null;
    const flags = this.recvBuffer[0];
    const longSize = (flags & ZMTP_FLAG_LONG) !== 0;
    const sizeFieldBytes = longSize ? 8 : 1;
    if (this.recvBuffer.length < (1 + sizeFieldBytes)) return null;

    let payloadLen = 0;
    if (longSize) {
      const lenBig = this.recvBuffer.readBigUInt64BE(1);
      if (lenBig > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("ZMQ frame too large");
      }
      payloadLen = Number(lenBig);
    } else {
      payloadLen = this.recvBuffer[1];
    }

    if (payloadLen > ZMTP_MAX_FRAME_BYTES) {
      throw new Error(`ZMQ frame exceeds ${ZMTP_MAX_FRAME_BYTES} bytes`);
    }

    const totalLen = 1 + sizeFieldBytes + payloadLen;
    if (this.recvBuffer.length < totalLen) return null;

    const payloadStart = 1 + sizeFieldBytes;
    const payloadEnd = payloadStart + payloadLen;
    const body = this.recvBuffer.subarray(payloadStart, payloadEnd);
    this.recvBuffer = this.recvBuffer.subarray(totalLen);

    return {
      more: (flags & ZMTP_FLAG_MORE) !== 0,
      command: (flags & ZMTP_FLAG_COMMAND) !== 0,
      body
    };
  }

  consumeBytes(byteCount) {
    const slice = this.recvBuffer.subarray(0, byteCount);
    this.recvBuffer = this.recvBuffer.subarray(byteCount);
    return slice;
  }

  resetSessionState() {
    this.recvBuffer = Buffer.alloc(0);
    this.messageParts = [];
    this.peerGreetingDone = false;
    this.clientReadySent = false;
    this.serverReady = false;
    this.subscribed = false;
  }

  closeSocket() {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    try {
      socket.removeAllListeners();
      socket.destroy();
    } catch (err) {
      // No-op.
    }
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    this.reconnectStreak += 1;
    const delayMs = reconnectBackoffMs(
      this.reconnectStreak,
      this.baseReconnectMs,
      this.maxReconnectMs
    );

    this.logger.warn("ZMQ hashblock subscriber disconnected, reconnecting", {
      endpoint: this.endpoint,
      retryMs: delayMs,
      failureStreak: this.reconnectStreak
    });
    this.emit("reconnect", {
      endpoint: this.endpoint,
      delayMs,
      failureStreak: this.reconnectStreak
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
    this.reconnectTimer.unref?.();
  }
}

function parseTcpEndpoint(endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) {
    throw new Error("ZMQ hashblock endpoint is required");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (err) {
    throw new Error(`Invalid ZMQ endpoint: ${raw}`);
  }

  if (parsed.protocol !== "tcp:") {
    throw new Error("Only tcp:// ZMQ endpoints are supported");
  }

  const host = parsed.hostname;
  const port = Number(parsed.port);
  if (!host) {
    throw new Error("ZMQ endpoint host is required");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("ZMQ endpoint port must be between 1 and 65535");
  }

  return { host, port };
}

function buildGreetingFrame() {
  const out = Buffer.alloc(ZMTP_GREETING_SIZE, 0);
  out[0] = 0xff;
  out[9] = 0x7f;
  out[10] = 0x03;
  out[11] = 0x01;
  Buffer.from("NULL", "utf8").copy(out, 12);
  out[32] = 0x00;
  return out;
}

function isValidGreeting(greeting) {
  if (!Buffer.isBuffer(greeting) || greeting.length < ZMTP_GREETING_SIZE) return false;
  return greeting[0] === 0xff && greeting[9] === 0x7f && greeting[10] >= 0x03;
}

function encodeFrame(flags, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.alloc(0);
  if (body.length <= 255) {
    return Buffer.concat([
      Buffer.from([flags & ~ZMTP_FLAG_LONG, body.length]),
      body
    ]);
  }

  const len = Buffer.alloc(8);
  len.writeBigUInt64BE(BigInt(body.length), 0);
  return Buffer.concat([
    Buffer.from([flags | ZMTP_FLAG_LONG]),
    len,
    body
  ]);
}

function parseCommandFrame(frameBody) {
  if (!Buffer.isBuffer(frameBody) || frameBody.length < 1) return null;
  const nameLen = frameBody[0];
  if (frameBody.length < (1 + nameLen)) return null;
  const name = frameBody.subarray(1, 1 + nameLen).toString("utf8").toUpperCase();
  const data = frameBody.subarray(1 + nameLen);
  return { name, data };
}

function encodeMetadataProperty(name, valueBuffer) {
  const key = Buffer.from(String(name || ""), "utf8");
  if (key.length <= 0 || key.length > 255) {
    throw new Error("Invalid ZMQ metadata key length");
  }
  const value = Buffer.isBuffer(valueBuffer)
    ? valueBuffer
    : Buffer.from(String(valueBuffer || ""), "utf8");
  const valueLen = Buffer.alloc(4);
  valueLen.writeUInt32BE(value.length, 0);
  return Buffer.concat([
    Buffer.from([key.length]),
    key,
    valueLen,
    value
  ]);
}

function reconnectBackoffMs(streak, baseMs, maxMs) {
  const safeStreak = Math.max(1, Number(streak || 1));
  const safeBase = Math.max(50, Number(baseMs || 250));
  const safeMax = Math.max(safeBase, Number(maxMs || 10000));
  const exponent = Math.min(6, safeStreak - 1);
  return Math.min(safeMax, safeBase * (2 ** exponent));
}

module.exports = { ZmqHashblockSubscriber };
