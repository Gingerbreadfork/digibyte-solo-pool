"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadConfig } = require("./config");
const { createLogger } = require("./logger");
const { RpcClient } = require("./rpc");
const { JobManager } = require("./job-manager");
const { StratumServer } = require("./stratum-server");
const { ApiServer } = require("./api-server");

loadEnvFile(path.resolve(process.cwd(), ".env"));

async function main() {
  const config = loadConfig();
  process.env.LOG_LEVEL = config.logLevel;
  const logger = createLogger();
  printStartupBanner(config);

  const stats = {
    startedAt: Date.now(),
    templatesFetched: 0,
    jobBroadcasts: 0,
    connectionsTotal: 0,
    sharesAccepted: 0,
    sharesRejected: 0,
    sharesStale: 0,
    sharesDuplicate: 0,
    sharesLowDiff: 0,
    blocksFound: 0,
    blocksRejected: 0,
    currentHeight: 0,
    currentNetworkBits: null,
    lastTemplateAt: 0,
    lastTemplateSource: null,
    lastTemplateFetchMs: 0,
    avgTemplateFetchMs: 0,
    lastBroadcastAt: 0,
    lastBroadcastClients: 0,
    lastShareAt: 0,
    lastShareWorker: null,
    lastFoundBlockHash: null,
    lastFoundBlockAt: 0,
    bestShareDifficulty: 0,
    bestShareWorker: null,
    bestShareAt: 0
  };

  const rpc = new RpcClient(config, logger);
  const jobManager = new JobManager(config, logger, rpc, stats);
  await jobManager.init();
  await jobManager.start();

  const stratum = new StratumServer(config, logger, jobManager, stats);
  stratum.start();

  const api = new ApiServer(config, logger, stats, jobManager, stratum);
  api.start();

  const shutdown = async (signal) => {
    logger.info("Shutting down", { signal });
    try {
      stratum.stop();
      api.stop();
      await jobManager.stop();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled rejection", { error: err && err.message ? err.message : String(err) });
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    process.env[key] = value;
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exit(1);
});

function printStartupBanner(config) {
  const stratumUrl = buildTcpUrl(config.stratumHost, config.stratumPort);
  const apiUrl = buildHttpUrl(config.apiHost, config.apiPort);
  const dashboardUrl = `${apiUrl}/`;
  const lines = [
    "",
    "  ____  _       _ ____        _        ____             _ ",
    " |  _ \\(_) __ _(_) __ ) _   _| |_ ___ |  _ \\ ___   ___ | |",
    " | | | | |/ _` | |  _ \\| | | | __/ _ \\| |_) / _ \\ / _ \\| |",
    " | |_| | | (_| | | |_) | |_| | ||  __/|  __/ (_) | (_) | |",
    " |____/|_|\\__, |_|____/ \\__, |\\__\\___||_|   \\___/ \\___/|_|",
    "          |___/         |___/                              ",
    "",
    `  POW        : ${String(config.powAlgo).toUpperCase()}`,
    `  Stratum     : ${stratumUrl}`,
    `  API         : ${apiUrl}`,
    `  Dashboard   : ${dashboardUrl}`,
    `  Log Level   : ${config.logLevel}`,
    ""
  ];
  process.stdout.write(lines.join("\n"));
}

function buildHttpUrl(host, port) {
  return `http://${formatHostForDisplay(host)}:${Number(port) || 8080}`;
}

function buildTcpUrl(host, port) {
  return `stratum+tcp://${formatHostForDisplay(host)}:${Number(port) || 3333}`;
}

function formatHostForDisplay(host) {
  const raw = String(host || "").trim();
  const display = (raw === "" || raw === "0.0.0.0" || raw === "::") ? "localhost" : raw;
  if (display.includes(":") && !display.startsWith("[")) {
    return `[${display}]`;
  }
  return display;
}
