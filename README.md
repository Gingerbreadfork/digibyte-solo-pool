# DigiByte Solo Stratum Pool (Plain Node.js)

**A production-ready, low-latency solo mining pool for DigiByte with zero dependencies.**

High-priority goals for this build:

- Low latency to your local DigiByte node (LAN-adjacent or same host)
- Simple self-hosting with Coolify (`Dockerfile` + compose)
- Solo focused payout model (single payout address)
- Multiple miners/devices over Stratum V1

## ✨ Features at a Glance

| Feature | Status |
|---------|--------|
| **Stratum V1 Protocol** | ✅ Full implementation with version rolling |
| **SHA256d Mining** | ✅ Native validation, other algos planned |
| **Variable Difficulty** | ✅ Per-miner automatic retargeting |
| **Longpoll** | ✅ Instant new block notifications |
| **Rate Limiting** | ✅ DoS protection with per-IP limits |
| **Live Dashboard** | ✅ Real-time stats with confetti on blocks 🎉 |
| **Prometheus Metrics** | ✅ Full observability with latency histograms |
| **TLS/HTTPS** | ✅ Optional secure API endpoints |
| **CORS Support** | ✅ Configurable cross-origin access |
| **Docker Security** | ✅ Non-root user, minimal attack surface |
| **Zero Dependencies** | ✅ Pure Node.js built-in modules only |

## Table of Contents

- [What it is](#what-it-is)
- [Current scope / performance notes](#current-scope--performance-notes)
- [Quick start](#quick-start)
- [Miner connection](#miner-connection)
- [DigiByte node config tips](#digibyte-node-config-tips)
- [Endpoints](#endpoints)
- [Security & Rate Limiting](#security--rate-limiting)
- [API Server Configuration](#api-server-configuration)
- [Prometheus Metrics](#prometheus-metrics)
- [Development](#development)
- [Important compatibility note](#important-compatibility-note)
- [Vardiff](#vardiff-enabled)
- [Environment Variables Reference](#environment-variables-reference)
- [Next performance upgrades](#next-performance-upgrades-practical)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## What it is

- Raw TCP Stratum server (`mining.subscribe`, `authorize`, `notify`, `submit`)
- Direct DigiByte JSON-RPC `getblocktemplate` + `submitblock`
- Longpoll support for fast new-block propagation
- In-memory solo pool state (no DB, no web framework overhead)
- Real-time dashboard via Server-Sent Events (zero dependencies)
- Status endpoints: `/healthz`, `/stats`, `/events`, `/metrics`
- Connection rate limiting and DoS protection
- Optional TLS/HTTPS for API endpoints
- Comprehensive Prometheus metrics with histograms
- Live dashboard with real-time updates and confetti celebrations

## Current scope / performance notes

- `POW_ALGO=sha256d` only (validated locally with built-in Node crypto)
- Optimized for low software overhead on a LAN and direct node adjacency
- Actual end-to-end latency depends mostly on:
  - miner firmware behavior
  - node responsiveness
  - LAN quality / switch buffering
  - ASIC TCP stack quirks

This implementation is designed to minimize pool-side overhead, but it cannot guarantee "beating" every hosted pool in every scenario because WAN routing and miner firmware dominate some latencies.

## Quick start

1. Create `.env` from `.env.example`.
2. Set `POOL_PAYOUT_ADDRESS` to your DigiByte address (required).
3. Ensure DigiByte Core RPC is reachable from this host/container.
4. Start with Docker/Coolify or local Node.

Important:

- Do not commit your local `.env` (RPC credentials, payout address, and auth tokens are secrets).
- `.env.example` is a template only.

### Local run

```bash
node src/index.js
```

### Docker (Coolify-friendly)

```bash
cp .env.example .env
docker compose -f docker-compose.coolify.yml up -d --build
```

Coolify can import this repo and deploy either:

- `Dockerfile` mode (recommended)
- `docker-compose.coolify.yml` mode

## Miner connection

Point miners to:

- `stratum+tcp://<pool-host>:3333`

Worker/user can be any string by default (`ALLOW_ANY_USER=true`), for example:

- user: `rig01`
- pass: `x,d=16384`

If you set `MINER_AUTH_TOKEN`, include it in password:

- `x,token=YOURTOKEN,d=32768`

## DigiByte node config tips

Your node should have RPC enabled and reachable by the pool container.

Typical requirements:

- `server=1`
- `algo=sha256d` (required for this pool)
- `rpcuser=...`
- `rpcpassword=...`
- `rpcallowip=<coolify/docker network>`
- `rpcbind=0.0.0.0` (or specific LAN IP)

Important on DigiByte multi-algo setups:

- This pool validates `sha256d` only.
- The pool now checks `getmininginfo.pow_algo` at startup and exits if the node reports a different algo (for example `scrypt`).
- Point `NODE_RPC_*` at a DigiByte daemon instance configured with `algo=sha256d`.

## Endpoints

- `GET /` or `/dashboard` - Live web dashboard with real-time updates
- `GET /events` - Server-Sent Events (SSE) stream for real-time stats
- `GET /healthz` - Health check (returns 200 if pool has active job)
- `GET /stats` - JSON stats snapshot (connections, shares, blocks, workers)
- `GET /metrics` - Prometheus metrics (plaintext format)

## Security & Rate Limiting

The pool includes built-in DoS protection and connection management:

### Connection Limits

```bash
# Maximum total concurrent connections
MAX_CLIENTS=1000

# Maximum connections per IP address
MAX_CLIENTS_PER_IP=10

# Maximum connection attempts per IP per minute
CONNECTION_RATE_LIMIT_PER_MIN=60
```

**How it works:**
- New connections are checked against total client limit
- Per-IP limits prevent single source from consuming all slots
- Rate limiting uses sliding 60-second window
- Rejected connections are logged with reason

**Recommended settings:**
- Solo mining (trusted IPs): Set high limits or disable (`MAX_CLIENTS=10000`)
- Public pool: Use defaults or lower (`MAX_CLIENTS_PER_IP=5`)
- Behind reverse proxy: Consider using proxy IP header (requires code modification)

### Docker Security

The pool runs as a non-root user (`pooluser`, UID 1001) in Docker for defense-in-depth security.

## API Server Configuration

### CORS (Cross-Origin Resource Sharing)

Enable browser-based dashboard access from different domains:

```bash
# Enable CORS headers (default: true)
API_CORS_ENABLED=true

# Allowed origin (default: *, use specific domain in production)
API_CORS_ORIGIN=*
# Or restrict to specific domain:
# API_CORS_ORIGIN=https://pool.example.com
```

### TLS/HTTPS Support

Secure your API and dashboard with HTTPS:

```bash
# Enable TLS (default: false)
API_TLS=true

# Paths to certificate and key (required if API_TLS=true)
API_TLS_CERT=/path/to/cert.pem
API_TLS_KEY=/path/to/key.pem
```

**Generate self-signed certificate for testing:**

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Production deployment:**
- Use Let's Encrypt certificates via certbot
- Place cert files in persistent volume
- Update `.env` with correct paths
- Ensure certificate renewal process updates the pool

**Note:** Stratum (port 3333) is always TCP. Only HTTP API supports TLS.

## Prometheus Metrics

The pool exports comprehensive metrics at `/metrics` in Prometheus format:

### Standard Pool Metrics

```
pool_connected_clients          # Current connected clients
pool_authorized_clients         # Current authorized clients
pool_templates_fetched_total    # Total templates fetched from node
pool_job_broadcasts_total       # Total job broadcasts to miners
pool_shares_accepted_total      # Total accepted shares
pool_shares_rejected_total      # Total rejected shares
pool_shares_stale_total         # Total stale shares
pool_shares_duplicate_total     # Total duplicate shares
pool_shares_lowdiff_total       # Total low-difficulty shares
pool_blocks_found_total         # Total blocks found
pool_blocks_rejected_total      # Total blocks rejected by node
pool_current_height             # Current blockchain height
pool_uptime_seconds             # Pool uptime in seconds
```

### API Performance Metrics

```
api_requests_total                              # Total API requests
api_requests_by_path{path="/stats"}            # Requests by endpoint
api_request_duration_seconds_bucket{le="0.01"} # Latency histogram
api_request_duration_seconds_count             # Total latency samples
```

**Latency histogram buckets:** 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, +Inf

**Example Prometheus scrape config:**

```yaml
scrape_configs:
  - job_name: 'digibyte-pool'
    static_configs:
      - targets: ['localhost:8080']
    scrape_interval: 15s
```

**Example Grafana queries:**

```promql
# Current hashrate estimate from share rate
rate(pool_shares_accepted_total[5m]) * BASE_DIFFICULTY * (2^32) / 600

# Share acceptance rate
rate(pool_shares_accepted_total[5m]) / rate(pool_shares_rejected_total[5m])

# API latency p95
histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))
```

## Development

### Prerequisites

- Node.js >= 20

### Project Structure

```
src/
├── index.js              # Entry point, signal handling
├── config.js             # Configuration loading and validation
├── logger.js             # JSON structured logging
├── utils.js              # Bitcoin/crypto primitives
├── rpc.js                # DigiByte RPC client
├── job-manager.js        # Block template and job management
├── stratum-server.js     # Stratum V1 protocol server
├── api-server.js         # HTTP/HTTPS API server
├── dashboard-page.js     # Dashboard HTML/CSS/JS
├── coinbase-builder.js   # Coinbase transaction construction
├── merkle.js             # Merkle tree operations
└── share-validator.js    # Share validation and header building
```

### Making Changes

1. Edit code
2. Test locally with `node src/index.js`
3. Check Docker build: `docker build -t dgb-pool .`

## Important compatibility note

Stratum prevhash formatting varies across miner implementations. Default is `STRATUM_PREVHASH_MODE=stratum`.

If a miner subscribes but never submits valid shares, test:

- `STRATUM_PREVHASH_MODE=stratum_wordrev` (required for NerdOCTAXE BM1370 firmware in local testing)
- `STRATUM_PREVHASH_MODE=header`
- `STRATUM_PREVHASH_MODE=rpc`

The pool can auto-rotate prevhash modes after repeated lowdiff shares, but set the correct mode explicitly once known to avoid startup thrash.

## Vardiff (enabled)

Per-miner vardiff is enabled and retargets based on accepted share timing.

Useful knobs:

- `ENABLE_VARDIFF=true|false`
- `VARDIFF_TARGET_SHARE_TIME_MS` (default `15000`)
- `VARDIFF_RETARGET_EVERY_SHARES` (default `4`)
- `VARDIFF_MAX_DIFFICULTY` (default `BASE_DIFFICULTY`)

## Environment Variables Reference

Complete list of configuration options (see `.env.example`):

### DigiByte Node RPC

```bash
NODE_RPC_HOST=127.0.0.1                  # RPC host
NODE_RPC_PORT=14022                      # RPC port (14022 = mainnet)
NODE_RPC_USER=your-rpc-user              # RPC username
NODE_RPC_PASS=your-rpc-password          # RPC password
NODE_RPC_TLS=false                       # Use HTTPS for RPC (rare)
NODE_RPC_TIMEOUT_MS=5000                 # Normal RPC timeout
NODE_RPC_LONGPOLL_TIMEOUT_MS=90000       # Longpoll timeout
ALLOW_NODE_POW_ALGO_MISMATCH=false       # Allow algo mismatch (not recommended)
```

### Stratum Server

```bash
STRATUM_HOST=0.0.0.0                     # Bind address (0.0.0.0 = all interfaces)
STRATUM_PORT=3333                        # Stratum port
STRATUM_PREVHASH_MODE=stratum            # Prevhash format: stratum|stratum_wordrev|header|rpc
SOCKET_IDLE_TIMEOUT_MS=300000            # Idle socket timeout (5 minutes)
```

### Connection Limits & Rate Limiting

```bash
MAX_CLIENTS=1000                         # Maximum total connections
MAX_CLIENTS_PER_IP=10                    # Maximum connections per IP
CONNECTION_RATE_LIMIT_PER_MIN=60         # Max connection attempts per IP per minute
```

### API Server

```bash
API_HOST=0.0.0.0                         # API bind address
API_PORT=8080                            # API port
API_TLS=false                            # Enable HTTPS
API_TLS_CERT=/path/to/cert.pem           # TLS certificate path (required if API_TLS=true)
API_TLS_KEY=/path/to/key.pem             # TLS key path (required if API_TLS=true)
API_CORS_ENABLED=true                    # Enable CORS headers
API_CORS_ORIGIN=*                        # CORS allowed origin
```

### Mining & Difficulty

```bash
POW_ALGO=sha256d                         # Proof-of-work algorithm (sha256d only currently)
BASE_DIFFICULTY=16384                    # Starting difficulty for new miners
MIN_DIFFICULTY=1                         # Minimum allowed difficulty
ENABLE_VARDIFF=true                      # Enable variable difficulty
VARDIFF_TARGET_SHARE_TIME_MS=15000       # Target time between shares (15 seconds)
VARDIFF_RETARGET_EVERY_SHARES=4          # Retarget difficulty every N shares
VARDIFF_MAX_DIFFICULTY=16384             # Maximum allowed difficulty
EXTRANONCE1_SIZE=4                       # Extranonce1 size in bytes (2-16)
EXTRANONCE2_SIZE=8                       # Extranonce2 size in bytes (2-16)
```

### Pool Configuration

```bash
POOL_PAYOUT_ADDRESS=dgb1...              # Your DigiByte payout address (REQUIRED)
POOL_PAYOUT_SCRIPT_HEX=                  # Advanced: Raw scriptPubKey hex (optional, leave empty)
POOL_TAG=/your-pool-tag/                 # Pool identifier in coinbase (max ~20 chars)
```

### Security & Authentication

```bash
ALLOW_ANY_USER=true                      # Allow any username (true for solo mining)
MINER_AUTH_TOKEN=                        # Optional: Require token in password (e.g., token=SECRET)
```

### Template Management

```bash
ENABLE_LONGPOLL=true                     # Enable longpoll for instant new block notification
TEMPLATE_POLL_MS=1000                    # Template poll interval when longpoll unavailable
TEMPLATE_POLL_MS_LONGPOLL_HEALTHY=5000   # Slower poll when longpoll is working
LONGPOLL_HEALTHY_GRACE_MS=120000         # How long to consider longpoll healthy (2 minutes)
TEMPLATE_FINGERPRINT_MODE=fast           # Template change detection: fast|full|prevhash
KEEP_OLD_JOBS=8                          # Number of recent jobs to keep in memory
MAX_JOB_SUBMISSIONS_TRACKED=50000        # Maximum dedupe entries per job
ENABLE_NEAR_CANDIDATE_PREWARM=true       # Prewarm block hex for near-candidate shares
NEAR_CANDIDATE_PREWARM_FACTOR=256        # Prewarm if share is within target * factor
GBT_RULES=segwit                         # getblocktemplate rules (comma-separated)
```

### Logging & Debugging

```bash
LOG_LEVEL=info                           # Logging level: debug|info|warn|error
DEBUG_SHARE_VALIDATION=false             # Extra diagnostics for share validation issues
```

## Next performance upgrades (practical)

1. Add native hash validators for other DigiByte algos (scrypt/skein/qubit/odocrypt) via optional addon.
2. Pin pool container to isolated CPU cores and use host networking in Coolify (if acceptable).
3. Run the pool on the same box as the DigiByte node or same L2 switch path.
4. Improve vardiff tuning/controls (smoother retargeting, per-miner persistence, anti-burst heuristics).

## Troubleshooting

### Miners connect but don't submit valid shares

1. Check `STRATUM_PREVHASH_MODE` - try different modes:
   - `stratum` (default, most common)
   - `stratum_wordrev` (some BM1370 firmware)
   - `header` or `rpc` (rare)

2. Enable debug logging: `LOG_LEVEL=debug DEBUG_SHARE_VALIDATION=true`

3. Check miner difficulty matches pool difficulty

### Connection rejected messages in logs

- **"max clients reached"**: Increase `MAX_CLIENTS`
- **"max clients per IP"**: Increase `MAX_CLIENTS_PER_IP` or check for IP conflicts
- **"rate limit exceeded"**: Increase `CONNECTION_RATE_LIMIT_PER_MIN` or investigate connection spam

### Pool not finding blocks

- Ensure miners are actually hashing (check dashboard for shares)
- This is solo mining - blocks are rare! Expected time: `network_difficulty / your_hashrate / 600` seconds
- Check `pool_blocks_rejected_total` metric - if >0, investigate node logs

### High API latency

- Check dashboard performance metrics at `/metrics`
- Dashboard uses Server-Sent Events (SSE) for real-time updates with minimal overhead
- `/stats` endpoint still available for polling-based integrations
- Consider adding reverse proxy cache for `/stats` if used by external tools

### TLS/HTTPS not working

- Verify certificate and key paths are correct
- Check file permissions (pool user must be able to read cert files)
- Ensure `API_TLS_CERT` and `API_TLS_KEY` both point to valid files
- Test certificate: `openssl x509 -in cert.pem -text -noout`

## Contributing

Contributions welcome! Please:

1. Follow existing code style
2. Test changes with real miners if modifying Stratum code
3. Document new environment variables in `.env.example`

## Warning

This software is provided as-is for self-hosted solo mining. Use at your own risk. Always verify the code before running in production, and never expose your mining pool directly to the internet without proper security measures.
