import request from '../../services/request.js';
import { stripHashPrefix } from '../../utils/stripHashPrefix.js';
import { BLOCKCHAINS } from '../../constants/blockchains.js';
import { TRANSACTION_APIS, TRANSACTION_ID_PLACEHOLDER } from '../../constants/api.js';
import CONFIG from '../../constants/config.js';
import { type TransactionData } from '../../models/transactionData';
import { type ExplorerAPI, type IParsingFunctionAPI } from '../../models/explorers';

// bring back ABI-decoding behavior from the old file
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - module has no types
import InputDataDecoder from 'ethereum-input-data-decoder';

/**
 * Blockscout (bloxberg) single-tx endpoint:
 *   https://blockexplorer.bloxberg.org/api?module=transaction&action=gettxinfo&txhash=<hash>
 * Contract ABI endpoint:
 *   https://blockexplorer.bloxberg.org/api?module=contract&action=getabi&address=<addr>
 */

function getTransactionServiceURL(): string {
  return `https://blockexplorer.bloxberg.org/api?module=transaction&action=gettxinfo&txhash=${TRANSACTION_ID_PLACEHOLDER}`;
}

function getAbiServiceURL(address: string): string {
  return `https://blockexplorer.bloxberg.org/api?module=contract&action=getabi&address=${address}`;
}

// Normalize seconds (decimal or hex) → Date
function normalizeTimestampToDate(ts: string | number | undefined): Date {
  if (ts == null) return new Date(0);
  if (typeof ts === 'string' && ts.startsWith('0x')) {
    const n = parseInt(ts, 16);
    return isFinite(n) ? new Date(n * 1000) : new Date(0);
  }
  const n = Number(ts);
  return isFinite(n) ? new Date(n * 1000) : new Date(0);
}

/** Fetch contract ABI from Blockscout; result may be a JSON string that itself needs JSON.parse */
async function getSmartContractABI(contractAddress: string): Promise<any[] | undefined> {
  try {
    const url = getAbiServiceURL(contractAddress);
    const res = await request({ url });
    const data = JSON.parse(res);
    const raw = data?.result;
    if (!raw) return undefined;
    // Blockscout returns ABI as a JSON string; parse if needed
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    // quietly fall back to raw input parsing
    return undefined;
  }
}

/** Try to decode tx input using ABI; return 0x-prefixed merkle root if found */
function decodeInputWithABI(abi: any[] | undefined, inputHex: string): string | undefined {
  if (!abi || !inputHex) return undefined;
  try {
    const decoder = new InputDataDecoder(abi);
    const decoded = decoder.decodeData(inputHex);
    // Heuristic: pick the first 32-byte-looking hex string in inputs
    const scan = (v: any): string | undefined => {
      if (typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v)) return v;
      if (Array.isArray(v)) {
        for (const item of v) {
          const got = scan(item);
          if (got) return got;
        }
      }
      if (v && typeof v === 'object') {
        for (const k of Object.keys(v)) {
          const got = scan(v[k]);
          if (got) return got;
        }
      }
      return undefined;
    };
    // prefer explicit inputs array; otherwise scan the whole decoded object
    let candidate: string | undefined;
    if (Array.isArray(decoded?.inputs)) {
      for (const inp of decoded.inputs) {
        candidate = scan(inp);
        if (candidate) break;
      }
    }
    return candidate ?? scan(decoded);
  } catch {
    return undefined;
  }
}

/** Convert Blockscout gettxinfo response to TransactionData; may use ABI decoding */
async function parseBlockscoutResponse(jsonResponse: any): Promise<TransactionData> {
  const data = jsonResponse?.result;
  if (!data) {
    throw new Error('Invalid Blockscout response');
  }

  const issuingAddress: string = String(data.from ?? '');
  const inputHex: string = String(data.input ?? data.data ?? ''); // Blockscout might use either key
  if (!issuingAddress || !inputHex) {
    throw new Error('Missing input/from in Blockscout result');
  }

  // Optional ABI decoding path (restored from your old file)
  let remoteHex = inputHex;
  if (data.to) {
    const abi = await getSmartContractABI(String(data.to));
    const decoded = decodeInputWithABI(abi, inputHex);
    if (decoded) remoteHex = decoded; // prefer ABI-decoded value if found
  }

  const remoteHash = stripHashPrefix(remoteHex, BLOCKCHAINS.ethmain.prefixes);
  const time: Date = normalizeTimestampToDate(data.timeStamp ?? data.timestamp);

  // Confirmations check (aligns with ethereum.ts behavior)
  const confirmations = Number(data.confirmations ?? 0);
  if (isFinite(confirmations) && confirmations < CONFIG.MininumConfirmations) {
    throw new Error('Not enough');
  }

  return {
    remoteHash,
    issuingAddress,
    time,
    revokedAddresses: []
  };
}

async function parsingFunction({ jsonResponse }: IParsingFunctionAPI): Promise<TransactionData> {
  return parseBlockscoutResponse(jsonResponse);
}

export const explorerApi: ExplorerAPI = {
  serviceURL: getTransactionServiceURL,
  serviceName: TRANSACTION_APIS.blockscout, // ensure 'blockscout' exists in constants/api.ts
  parsingFunction,
  priority: -1
};