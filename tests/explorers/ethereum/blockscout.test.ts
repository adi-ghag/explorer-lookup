import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { explorerApi } from '../../../src/explorers/ethereum/blockscout';
import * as RequestServices from '../../../src/services/request';
import { type TransactionData } from '../../../src/models/transactionData';

// Deep-clone helper
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getMockBlockscoutResponse () {
  // Matches Blockscout `gettxinfo` shape we use: { result: { input, from, timeStamp, confirmations, ... } }
  return {
    status: '1',
    message: 'OK',
    result: {
      hash: '0xabc',
      from: '0x3d995ef85a8d1bcbed78182ab225b9f88dc8937c',
      // 32-byte hex payload as typical Blockcert merkle root (in tx input)
      input: '0x' + 'ec049a808a09f3e8e257401e0898aa3d32a733706fd7d16aacf0ba95f7b42c0c',
      // hex seconds (100000000) → 1973-03-03T09:46:40.000Z
      timeStamp: '0x5f5e100',
      confirmations: '12'
    }
  };
}

describe('Blockscout (bloxberg) Explorer test suite', function () {
  describe('parsingFunction method', function () {
    let mockResponse: any;
    let stubRequest: ReturnType<typeof vi.spyOn>;

    beforeEach(function () {
      mockResponse = clone(getMockBlockscoutResponse());
      // We only call `request` when we try to fetch the contract ABI.
      stubRequest = vi.spyOn(RequestServices, 'default');
    });

    afterEach(function () {
      vi.restoreAllMocks();
    });

    it('should return the transaction data (raw input path, no ABI)', async function () {
      // Ensure no ABI fetch: remove `to`
      delete mockResponse.result.to;

      const assertionTransactionData: TransactionData = {
        issuingAddress: mockResponse.result.from,
        remoteHash: 'ec049a808a09f3e8e257401e0898aa3d32a733706fd7d16aacf0ba95f7b42c0c',
        revokedAddresses: [],
        time: new Date(100000000000) // from 0x5f5e100
      };

      const res = await (explorerApi.parsingFunction as any)({ jsonResponse: mockResponse });
      expect(res).toEqual(assertionTransactionData);
      expect(stubRequest).not.toHaveBeenCalled();
    });

    it('should fall back to raw input when ABI fetch fails', async function () {
      // Trigger ABI path by providing `to` (contract address)
      mockResponse.result.to = '0x000000000000000000000000000000000000c0de';
      // Simulate ABI endpoint failure
      stubRequest.mockRejectedValue(new Error('rejected'));

      const res = await (explorerApi.parsingFunction as any)({ jsonResponse: mockResponse });
      expect(res.remoteHash).toBe('ec049a808a09f3e8e257401e0898aa3d32a733706fd7d16aacf0ba95f7b42c0c');
      expect(stubRequest).toHaveBeenCalledTimes(1);
    });

    it('should throw when confirmations are insufficient', async function () {
      mockResponse.result.confirmations = '0'; // below CONFIG.MininumConfirmations
      await expect((explorerApi.parsingFunction as any)({ jsonResponse: mockResponse }))
        .rejects.toThrow('Not enough');
    });
  });
});