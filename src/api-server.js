"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const { renderDashboardHtml } = require("./dashboard-page");

class ApiServer {
  constructor(config, logger, stats, jobManager, stratumServer) {
    this.config = config;
    this.logger = logger;
    this.stats = stats;
    this.jobManager = jobManager;
    this.stratumServer = stratumServer;
    this.server = null;
    this.startedAt = Date.now();

    // SSE clients
    this.sseClients = new Set();
    this.sseInterval = null;

    // Stats logging interval (log metrics every 30 seconds by default)
    this.statsLoggingInterval = null;
    this.statsLoggingMs = parseInt(process.env.STATS_LOGGING_INTERVAL_MS || "30000", 10);

    // Metrics histograms (simple buckets for latency tracking)
    this.metrics = {
      requestCount: 0,
      requestLatencyBuckets: {
        "0.005": 0,  // 5ms
        "0.01": 0,   // 10ms
        "0.025": 0,  // 25ms
        "0.05": 0,   // 50ms
        "0.1": 0,    // 100ms
        "0.25": 0,   // 250ms
        "0.5": 0,    // 500ms
        "1": 0,      // 1s
        "+Inf": 0
      },
      requestsByPath: {}
    };
  }

  start() {
    const requestHandler = (req, res) => this.handle(req, res);

    if (this.config.apiTls) {
      const tlsOptions = {
        cert: fs.readFileSync(this.config.apiTlsCert),
        key: fs.readFileSync(this.config.apiTlsKey)
      };
      this.server = https.createServer(tlsOptions, requestHandler);
    } else {
      this.server = http.createServer(requestHandler);
    }

    this.server.listen(this.config.apiPort, this.config.apiHost, () => {
      this.logger.info("API listening", {
        host: this.config.apiHost,
        port: this.config.apiPort,
        tls: this.config.apiTls,
        cors: this.config.apiCorsEnabled
      });
      const protocol = this.config.apiTls ? "https" : "http";
      writeAlwaysLine(`Dashboard: ${buildDashboardUrl(this.config.apiHost, this.config.apiPort, protocol)}`);
    });

    // Start SSE broadcast interval (send updates every second)
    this.sseInterval = setInterval(() => this.broadcastToSSEClients(), 1000);

    // Start stats logging interval (log metrics periodically even when dashboard closed)
    this.statsLoggingInterval = setInterval(() => this.logStats(), this.statsLoggingMs);
  }

  stop() {
    if (this.sseInterval) {
      clearInterval(this.sseInterval);
      this.sseInterval = null;
    }
    if (this.statsLoggingInterval) {
      clearInterval(this.statsLoggingInterval);
      this.statsLoggingInterval = null;
    }
    // Close all SSE connections
    for (const client of this.sseClients) {
      try {
        client.end();
      } catch (err) {
        // Ignore errors on cleanup
      }
    }
    this.sseClients.clear();
    if (this.server) this.server.close();
  }

  handle(req, res) {
    const startTime = process.hrtime.bigint();
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    // CORS headers
    if (this.config.apiCorsEnabled) {
      res.setHeader("Access-Control-Allow-Origin", this.config.apiCorsOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Handle POST /reset endpoint
    if (req.method === "POST" && pathname === "/reset") {
      this.resetStats();
      return this.writeJson(res, 200, { success: true, message: "Stats reset successfully" });
    }

    // Track metrics
    this.metrics.requestCount += 1;
    this.metrics.requestsByPath[pathname] = (this.metrics.requestsByPath[pathname] || 0) + 1;

    // Handle request and track latency
    const finishHandler = () => {
      const endTime = process.hrtime.bigint();
      const durationSec = Number(endTime - startTime) / 1e9;
      this.recordLatency(durationSec);
    };
    res.on("finish", finishHandler);

    if (pathname === "/" || pathname === "/dashboard") {
      return this.writeHtml(res, 200, renderDashboardHtml(), {
        "Cache-Control": "no-store, max-age=0"
      });
    }

    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/healthz") {
      const ok = Boolean(this.jobManager.currentJobSnapshot());
      return this.writeJson(res, ok ? 200 : 503, {
        ok,
        hasJob: ok
      });
    }

    if (url.pathname === "/stats") {
      const job = this.jobManager.currentJobSnapshot();
      const connections = this.stratumServer.snapshot();
      return this.writeJson(res, 200, {
        uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
        job: job ? {
          id: job.jobId,
          height: job.template.height,
          bits: job.bitsHex,
          createdAt: job.createdAt,
          cleanJobs: job.cleanJobs,
          txCount: 1 + job.transactions.length,
          segwit: job.segwit
        } : null,
        connections,
        stats: this.stats
      });
    }

    if (url.pathname === "/events") {
      return this.handleSSE(req, res);
    }

    if (pathname === "/metrics") {
      const connections = this.stratumServer.snapshot();
      const lines = [];

      // Standard metrics
      pushMetric(lines, "pool_connected_clients", connections.connected);
      pushMetric(lines, "pool_authorized_clients", connections.authorized);
      pushMetric(lines, "pool_templates_fetched_total", this.stats.templatesFetched);
      pushMetric(lines, "pool_job_broadcasts_total", this.stats.jobBroadcasts);
      pushMetric(lines, "pool_shares_accepted_total", this.stats.sharesAccepted);
      pushMetric(lines, "pool_shares_rejected_total", this.stats.sharesRejected);
      pushMetric(lines, "pool_shares_stale_total", this.stats.sharesStale);
      pushMetric(lines, "pool_shares_duplicate_total", this.stats.sharesDuplicate);
      pushMetric(lines, "pool_shares_lowdiff_total", this.stats.sharesLowDiff);
      pushMetric(lines, "pool_blocks_found_total", this.stats.blocksFound);
      pushMetric(lines, "pool_blocks_rejected_total", this.stats.blocksRejected);
      pushMetric(lines, "pool_current_height", this.stats.currentHeight || 0);
      pushMetric(lines, "pool_uptime_seconds", Math.floor((Date.now() - this.startedAt) / 1000));

      // API metrics
      pushMetric(lines, "api_requests_total", this.metrics.requestCount);

      // Request latency histogram
      lines.push("# HELP api_request_duration_seconds API request latency histogram");
      lines.push("# TYPE api_request_duration_seconds histogram");
      for (const [le, count] of Object.entries(this.metrics.requestLatencyBuckets)) {
        lines.push(`api_request_duration_seconds_bucket{le="${le}"} ${count}`);
      }
      lines.push(`api_request_duration_seconds_count ${this.metrics.requestCount}`);

      // Requests by path
      for (const [path, count] of Object.entries(this.metrics.requestsByPath)) {
        pushMetric(lines, `api_requests_by_path{path="${path}"}`, count);
      }

      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(lines.join("\n") + "\n");
      return;
    }

    this.writeJson(res, 404, { error: "not_found" });
  }

  handleSSE(req, res) {
    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": this.config.apiCorsEnabled ? this.config.apiCorsOrigin : "*"
    });

    // Send initial connection message
    res.write(": connected\n\n");

    // Add client to set
    this.sseClients.add(res);
    this.logger.debug("SSE client connected", { total: this.sseClients.size });

    // Remove client on close
    req.on("close", () => {
      this.sseClients.delete(res);
      this.logger.debug("SSE client disconnected", { total: this.sseClients.size });
    });
  }

  broadcastToSSEClients() {
    if (this.sseClients.size === 0) return;

    const job = this.jobManager.currentJobSnapshot();
    const connections = this.stratumServer.snapshot();
    const data = {
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      job: job ? {
        id: job.jobId,
        height: job.template.height,
        bits: job.bitsHex,
        createdAt: job.createdAt,
        cleanJobs: job.cleanJobs,
        txCount: 1 + job.transactions.length,
        segwit: job.segwit
      } : null,
      connections,
      stats: this.stats
    };

    const message = `data: ${JSON.stringify(data)}\n\n`;
    const deadClients = [];

    for (const client of this.sseClients) {
      try {
        client.write(message);
      } catch (err) {
        deadClients.push(client);
      }
    }

    // Clean up dead connections
    for (const client of deadClients) {
      this.sseClients.delete(client);
    }
  }

  writeJson(res, statusCode, body) {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(payload)
    });
    res.end(payload);
  }

  writeHtml(res, statusCode, html, extraHeaders) {
    const payload = String(html);
    res.writeHead(statusCode, Object.assign({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload)
    }, extraHeaders || {}));
    res.end(payload);
  }

  recordLatency(durationSec) {
    const buckets = ["0.005", "0.01", "0.025", "0.05", "0.1", "0.25", "0.5", "1", "+Inf"];
    for (const bucket of buckets) {
      if (bucket === "+Inf" || durationSec <= parseFloat(bucket)) {
        this.metrics.requestLatencyBuckets[bucket] += 1;
        break;
      }
    }
  }

  logStats() {
    const connections = this.stratumServer.snapshot();
    const uptimeSec = Math.floor((Date.now() - this.startedAt) / 1000);

    // Calculate hashrate estimate from share rate (if we have shares)
    const totalShares = this.stats.sharesAccepted + this.stats.sharesRejected;
    const hashrateEstimate = totalShares > 0
      ? ((this.stats.sharesAccepted / uptimeSec) * 16384 * Math.pow(2, 32) / 600).toFixed(2) + " H/s"
      : "0 H/s";

    this.logger.info("Pool stats snapshot", {
      uptime: formatDuration(uptimeSec),
      connections: {
        connected: connections.connected,
        authorized: connections.authorized
      },
      shares: {
        accepted: this.stats.sharesAccepted,
        rejected: this.stats.sharesRejected,
        rejectRate: totalShares > 0 ? ((this.stats.sharesRejected / totalShares) * 100).toFixed(2) + "%" : "0%",
        stale: this.stats.sharesStale,
        duplicate: this.stats.sharesDuplicate,
        lowdiff: this.stats.sharesLowDiff
      },
      blocks: {
        found: this.stats.blocksFound,
        rejected: this.stats.blocksRejected
      },
      bestShare: this.stats.bestShareDifficulty > 0 ? {
        difficulty: this.stats.bestShareDifficulty,
        worker: this.stats.bestShareWorker,
        age: this.stats.bestShareAt ? Math.floor((Date.now() - this.stats.bestShareAt) / 1000) + "s ago" : "never"
      } : null,
      hashrate: hashrateEstimate,
      height: this.stats.currentHeight
    });
  }

  resetStats() {
    // Reset counters but preserve certain all-time stats
    const bestShareDiff = this.stats.bestShareDifficulty;
    const bestShareWorker = this.stats.bestShareWorker;
    const bestShareAt = this.stats.bestShareAt;
    const blocksFound = this.stats.blocksFound;
    const lastFoundBlockHash = this.stats.lastFoundBlockHash;
    const lastFoundBlockAt = this.stats.lastFoundBlockAt;

    // Reset session stats
    this.stats.templatesFetched = 0;
    this.stats.jobBroadcasts = 0;
    this.stats.sharesAccepted = 0;
    this.stats.sharesRejected = 0;
    this.stats.sharesStale = 0;
    this.stats.sharesDuplicate = 0;
    this.stats.sharesLowDiff = 0;
    this.stats.blocksRejected = 0;
    this.stats.lastTemplateAt = 0;
    this.stats.lastBroadcastAt = 0;
    this.stats.lastShareAt = 0;
    this.stats.lastShareWorker = null;
    this.stats.recentShares = [];

    // Restore all-time bests
    this.stats.bestShareDifficulty = bestShareDiff;
    this.stats.bestShareWorker = bestShareWorker;
    this.stats.bestShareAt = bestShareAt;
    this.stats.blocksFound = blocksFound;
    this.stats.lastFoundBlockHash = lastFoundBlockHash;
    this.stats.lastFoundBlockAt = lastFoundBlockAt;

    // Reset pool start time for session stats
    this.startedAt = Date.now();

    this.logger.info("Pool stats reset", { preservedBestShare: bestShareDiff > 0 });
  }
}

function pushMetric(lines, key, value) {
  lines.push(`${key} ${Number(value)}`);
}

function buildDashboardUrl(host, port, protocol) {
  const h = String(host || "").trim();
  const displayHost = (h === "0.0.0.0" || h === "::" || h === "") ? "localhost" : h;
  const bracketedHost = displayHost.includes(":") && !displayHost.startsWith("[")
    ? `[${displayHost}]`
    : displayHost;
  const proto = protocol || "http";
  return `${proto}://${bracketedHost}:${Number(port) || 8080}/`;
}

function writeAlwaysLine(line) {
  process.stdout.write(String(line) + "\n");
}

function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

module.exports = { ApiServer };
