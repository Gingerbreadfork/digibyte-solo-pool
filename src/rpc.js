"use strict";

const http = require("node:http");
const https = require("node:https");

class RpcClient {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    const AgentCtor = config.nodeRpcTls ? https.Agent : http.Agent;
    this.agent = new AgentCtor({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 16
    });
    this.longpollAgent = new AgentCtor({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 2
    });
    this.authHeader = `Basic ${Buffer.from(
      `${this.config.nodeRpcUser}:${this.config.nodeRpcPass}`
    ).toString("base64")}`;
    this.idSeq = 0;
  }

  async call(method, params = [], options = {}) {
    const isLongpoll = Boolean(options.longpoll);
    const timeoutMs = options.timeoutMs || (isLongpoll
      ? this.config.nodeRpcLongpollTimeoutMs
      : this.config.nodeRpcTimeoutMs);
    const transport = this.config.nodeRpcTls ? https : http;
    const agent = isLongpoll ? this.longpollAgent : this.agent;

    const body = JSON.stringify({
      jsonrpc: "1.0",
      id: ++this.idSeq,
      method,
      params
    });

    const requestOptions = {
      host: this.config.nodeRpcHost,
      port: this.config.nodeRpcPort,
      method: "POST",
      path: "/",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: this.authHeader,
        Connection: "keep-alive"
      },
      agent,
      timeout: timeoutMs
    };

    return new Promise((resolve, reject) => {
      const req = transport.request(requestOptions, (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (d) => {
          chunks += d;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`RPC HTTP ${res.statusCode}: ${chunks}`));
          }
          let parsed;
          try {
            parsed = JSON.parse(chunks);
          } catch (err) {
            return reject(new Error(`RPC JSON parse failed: ${err.message}`));
          }
          if (parsed.error) {
            return reject(new Error(`RPC ${method} error: ${JSON.stringify(parsed.error)}`));
          }
          resolve(parsed.result);
        });
      });

      req.on("timeout", () => {
        req.destroy(new Error(`RPC ${method} timeout after ${timeoutMs}ms`));
      });
      req.on("error", reject);
      req.end(body);
    });
  }

  async getBlockTemplate(longpollId) {
    const request = {
      capabilities: ["coinbasevalue", "workid", "longpoll", "proposal"],
      rules: this.config.gbtRules
    };
    if (this.config.powAlgo) {
      request.algo = this.config.powAlgo;
      request.pow_algo = this.config.powAlgo;
      request.algorithm = this.config.powAlgo;
    }
    if (longpollId) request.longpollid = longpollId;
    return this.call("getblocktemplate", [request], { longpoll: Boolean(longpollId) });
  }

  async submitBlock(blockHex, workId) {
    const params = [blockHex];
    if (workId) {
      params.push({ workid: String(workId) });
    }
    return this.call("submitblock", params);
  }

  async validateAddress(address) {
    try {
      const result = await this.call("validateaddress", [address]);
      return result;
    } catch (err) {
      this.logger.warn("validateaddress RPC failed", { error: err.message });
      return null;
    }
  }

  async getMiningInfo() {
    try {
      return await this.call("getmininginfo");
    } catch (err) {
      this.logger.warn("getmininginfo RPC failed", { error: err.message });
      return null;
    }
  }
}

module.exports = { RpcClient };
