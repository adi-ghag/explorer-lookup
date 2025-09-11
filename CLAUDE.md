# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Compilation
- `npm run compile` - Full build: clean, compile TypeScript (ES modules + CommonJS), and generate type declarations
- `npm run build` - Basic TypeScript compilation to ES modules only
- `npm run clean:build` - Remove lib/ directory
- `npm run dts:bundle` - Generate bundled type declaration file

### Testing
- `npm test` - Run all tests once with Vitest
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:coverage:report` - Upload coverage to Codecov

### Code Quality
- `npm run lint` - Lint TypeScript files with ESLint

### Package Management
- `npm run semantic-release` - Automated versioning and publishing
- `npm run prepare` - Set up Husky git hooks (runs automatically after npm install)

## Architecture Overview

This is a TypeScript library for querying blockchain transaction data from multiple explorer APIs and RPC endpoints. The architecture follows a modular, extensible design:

### Core Components

**Main Entry Point (`src/lookForTx.ts`)**
- Primary function `lookForTx()` orchestrates transaction lookups
- Implements failover mechanism with promise racing across multiple explorers
- Validates consistency of results from multiple sources
- Supports custom explorer APIs with priority-based execution

**Blockchain Support (`src/constants/`)**
- `blockchains.ts` - Defines supported chains (Bitcoin, Ethereum, testnets, Arbitrum, bloxberg)
- `supported-chains.ts` - Enum of all supported blockchain networks
- `api.ts` - API endpoint configurations and constants
- `config.ts` - Runtime configuration (minimum explorers, racing settings)

**Explorer Implementations (`src/explorers/`)**
- Separate modules for Bitcoin (`bitcoin/`) and Ethereum (`ethereum/`) explorers
- Each explorer (Blockstream, Etherscan, Blockscout, etc.) implements standardized interface
- RPC support (`rpc/`) for direct node communication
- Factory pattern in `explorer.ts` creates explorer instances with consistent API

**Data Models (`src/models/`)**
- `transactionData.ts` - Standardized transaction data structure
- `explorers.ts` - Explorer API interface definitions and types

**Services (`src/services/`)**
- `request.ts` - HTTP client for API calls
- `transaction-apis.ts` - API endpoint management and routing

### Build System

- **Dual Module Support**: Generates both ES modules (`lib/esm/`) and CommonJS (`lib/cjs/`)
- **TypeScript**: Source in `src/`, compiled output in `lib/`
- **Type Declarations**: Bundled into single `lib/index.d.ts` file
- **Testing**: Vitest with comprehensive mocks in `tests/explorers/mocks/`

### Key Design Patterns

1. **Promise Racing**: Multiple explorers queried simultaneously for reliability
2. **Failover Chain**: Custom explorers → default explorers → fallback by priority
3. **Result Validation**: Cross-checks issuing addresses and transaction hashes
4. **Extensibility**: Custom explorer APIs can override defaults or add new chains
5. **Type Safety**: Full TypeScript coverage with strict configurations