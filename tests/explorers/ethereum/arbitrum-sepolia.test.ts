import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as mockEtherscanResponse from '../mocks/mockEtherscanResponse.json';
import { explorerApi } from '../../../src/explorers/ethereum/etherscan';
import * as RequestServices from '../../../src/services/request';
import { type TransactionData } from '../../../src/models/transactionData';
import { SupportedChains } from '../../../src/constants/supported-chains';

function getMockArbitrumSepoliaResponse (): typeof mockEtherscanResponse {
  const mockResponse = JSON.parse(JSON.stringify(mockEtherscanResponse));
  // Modify response for Arbitrum Sepolia specifics
  mockResponse.result.blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  mockResponse.result.blockNumber = '0x123456';
  mockResponse.result.from = '0x3d995ef85a8d1bcbed78182ab225b9f88dc8937c';
  mockResponse.result.hash = '0xarbitrumsepolia808a09f3e8e257401e0898aa3d32a733706fd7d16aacf0ba95f7';
  return mockResponse;
}

describe('Arbitrum Sepolia Explorer test suite', function () {
  describe('parsingFunction method', function () {
    let mockResponse: typeof mockEtherscanResponse;
    let stubRequest: ReturnType<typeof vi.spyOn>;

    beforeEach(function () {
      mockResponse = getMockArbitrumSepoliaResponse();
      stubRequest = vi.spyOn(RequestServices, 'default');
    });

    afterEach(function () {
      vi.restoreAllMocks();
    });

    it('should return the transaction data for Arbitrum Sepolia', async function () {
      // Mock the block response for getEtherScanBlock
      const mockBlockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          timestamp: '0x5cf38b02',
          number: '0x123456',
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        }
      };

      // Mock the current block number response for confirmation check
      const mockCurrentBlockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: '0x123466' // 16 blocks ahead for sufficient confirmations
      };

      stubRequest
        .mockResolvedValueOnce(JSON.stringify(mockBlockResponse))
        .mockResolvedValueOnce(JSON.stringify(mockCurrentBlockResponse));

      const assertionTransactionData: TransactionData = {
        issuingAddress: '0x3d995ef85a8d1bcbed78182ab225b9f88dc8937c',
        remoteHash: 'ec049a808a09f3e8e257401e0898aa3d32a733706fd7d16aacf0ba95f7b42c0c',
        revokedAddresses: [],
        time: new Date('2019-06-02T08:38:26.000Z')
      };

      const res = await explorerApi.parsingFunction({ 
        jsonResponse: mockResponse, 
        chain: SupportedChains.ArbitrumSepolia 
      });
      expect(res).toEqual(assertionTransactionData);
    });

    it('should use correct API URL for Arbitrum Sepolia', function () {
      const serviceURL = explorerApi.serviceURL(SupportedChains.ArbitrumSepolia);
      expect(serviceURL).toContain('chainid=421614');
      expect(serviceURL).toContain('api.etherscan.io/v2/api');
      expect(serviceURL).toContain('action=eth_getTransactionByHash');
    });

    it('should handle API errors gracefully for Arbitrum Sepolia', async function () {
      stubRequest.mockRejectedValue(new Error('Network error'));
      
      await expect(explorerApi.parsingFunction({ 
        jsonResponse: mockResponse, 
        chain: SupportedChains.ArbitrumSepolia 
      })).rejects.toThrow('Unable to get remote hash');
    });

    it('should validate minimum confirmations for Arbitrum Sepolia', async function () {
      // Mock block response
      const mockBlockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          timestamp: '0x5cf38b02',
          number: '0x123456'
        }
      };

      // Mock insufficient confirmations - current block number converted to decimal
      const mockCurrentBlockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: parseInt('0x123456', 16) // Same block number, insufficient confirmations
      };

      stubRequest
        .mockResolvedValueOnce(JSON.stringify(mockBlockResponse))
        .mockResolvedValueOnce(JSON.stringify(mockCurrentBlockResponse));

      // The etherscan implementation catches the "Not enough" error and rethrows as "Unable to get remote hash"
      await expect(explorerApi.parsingFunction({ 
        jsonResponse: mockResponse, 
        chain: SupportedChains.ArbitrumSepolia 
      })).rejects.toThrow('Unable to get remote hash');
    });

    it('should extract correct chain ID for Arbitrum Sepolia', function () {
      const chain = SupportedChains.ArbitrumSepolia;
      const serviceURL = explorerApi.serviceURL(chain);
      
      // Arbitrum Sepolia chain ID is 421614
      expect(serviceURL).toContain('chainid=421614');
    });
  });
});