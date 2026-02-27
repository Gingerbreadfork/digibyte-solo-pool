# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

#### Security & Rate Limiting
- Connection rate limiting with configurable per-IP limits
- Maximum total clients limit (`MAX_CLIENTS`)
- Maximum clients per IP limit (`MAX_CLIENTS_PER_IP`)
- Connection rate limiting (`CONNECTION_RATE_LIMIT_PER_MIN`)
- Docker container now runs as non-root user (`pooluser`, UID 1001)
- Automatic cleanup of rate limit tracking data

#### API Enhancements
- Optional TLS/HTTPS support for API server
  - `API_TLS` configuration option
  - `API_TLS_CERT` and `API_TLS_KEY` for certificate paths
- CORS headers support
  - `API_CORS_ENABLED` to toggle CORS
  - `API_CORS_ORIGIN` to configure allowed origins
- Enhanced Prometheus metrics
  - Request latency histogram with 8 buckets (5ms to 1s)
  - Total request counter
  - Requests by path (labeled metrics)
  - High-resolution timing using `process.hrtime.bigint()`

#### Code Quality & Development
- ESLint configuration for code quality
- Prettier configuration for code formatting
- npm scripts for linting and formatting
  - `npm run lint` - Check code for issues
  - `npm run lint:fix` - Auto-fix linting issues
  - `npm run format` - Format code
  - `npm run format:check` - Check formatting (CI-friendly)

#### Code Organization
- New modular architecture with separate files:
  - `src/coinbase-builder.js` - Coinbase transaction construction
  - `src/merkle.js` - Merkle tree operations
  - `src/share-validator.js` - Share validation and header building
- Comprehensive JSDoc comments in new modules

#### Documentation
- Expanded README with table of contents
- Features at a glance section with badges
- Complete environment variables reference
- Security & Rate Limiting section
- API Server Configuration section
- Prometheus Metrics documentation with example queries
- Development workflow documentation
- Troubleshooting guide
- Contributing guidelines
- Project structure overview

### Changed
- Dashboard URL now includes protocol (http/https) based on TLS configuration
- API server logs now include TLS and CORS status on startup
- Stratum server logs now include connection limit configuration on startup
- Enhanced logging for connection rejections (includes reason and IP)

### Security
- Docker container no longer runs as root (breaking change for some deployments)
- Added DoS protection through rate limiting
- Added connection limits to prevent resource exhaustion

## [0.1.0] - Initial Release

### Added
- Stratum V1 protocol server
- DigiByte node RPC integration
- Longpoll support
- Variable difficulty (vardiff)
- Web dashboard
- Basic Prometheus metrics
- Docker and docker-compose support
- Multiple prevhash modes for miner compatibility
- Share validation and deduplication
- Block candidate submission
- Auto-rotating prevhash modes for problematic miners
- Auto-lowering difficulty for struggling miners

[Unreleased]: https://github.com/yourusername/digibyte-mining-pool/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/digibyte-mining-pool/releases/tag/v0.1.0
