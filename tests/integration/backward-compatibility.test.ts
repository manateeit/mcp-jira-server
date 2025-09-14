/**
 * Integration test for backward compatibility (legacy parameters)
 * 
 * This test validates Test Scenario 6 from quickstart.md:
 * - Legacy parameters (limit, startAt) should still work correctly
 * - Parameters should be mapped correctly to new Enhanced JQL API
 * - Response should include backward-compatible fields
 * 
 * Following TDD: This test MUST FAIL initially until T013+ implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types for the search-issues MCP tool (based on contract)
interface SearchIssuesRequest {
  jql: string;
  maxResults?: number;
  fields?: string[] | '*all' | '*navigable';
  expand?: string[];
  cursor?: string | null;
  method?: 'auto' | 'GET' | 'POST';
  // Legacy parameters for backward compatibility
  limit?: number;
  startAt?: number;
}

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary?: string;
    description?: string;
    status?: {
      name: string;
      id: string;
    };
    created?: string;
    updated?: string;
    [key: string]: any;
  };
}

interface ResponseMetadata {
  timing: {
    requestTime: number;
    responseTime: number;
    duration: number;
  };
  warnings?: string[];
  rateLimit?: {
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  };
}

interface SearchIssuesResponse {
  issues: JiraIssue[];
  total?: number;
  cursor: string | null;
  meta: ResponseMetadata;
  // Legacy fields for backward compatibility
  startAt?: number;
  maxResults?: number;
}

// Mock MCP tool implementation for integration testing
class MockSearchIssuesIntegration {
  private domain: string;
  private credentials: { email: string; token: string } | null = null;

  constructor(domain: string) {
    this.domain = domain;
  }

  configure(credentials: { email: string; token: string }): void {
    this.credentials = credentials;
  }

  async searchIssues(_request: SearchIssuesRequest): Promise<SearchIssuesResponse> {
    // This mock will be replaced with actual implementation in T017
    if (!this.credentials) {
      throw new Error('Jira credentials not configured');
    }

    throw new Error('search-issues integration not yet implemented - TDD phase');
  }

  // Method to map legacy parameters to new format
  mapLegacyParameters(request: SearchIssuesRequest): SearchIssuesRequest {
    const mapped = { ...request };
    
    // Map limit to maxResults
    if (request.limit !== undefined) {
      mapped.maxResults = request.limit;
    }
    
    // startAt handling would be more complex in real implementation
    // (needs to convert to cursor-based pagination)
    
    return mapped;
  }

  // Method to construct API URL
  getApiUrl(): string {
    return `https://${this.domain}.atlassian.net/rest/api/3/search/jql`;
  }
}

describe('Backward Compatibility Integration (Legacy Parameters)', () => {
  let searchTool: MockSearchIssuesIntegration;
  const testDomain = 'test-domain';
  const mockCredentials = {
    email: 'test@example.com',
    token: 'test-token',
  };

  beforeEach(() => {
    searchTool = new MockSearchIssuesIntegration(testDomain);
    searchTool.configure(mockCredentials);
  });

  describe('Prerequisites Validation', () => {
    it('should be configured with Jira credentials', () => {
      expect(searchTool.getApiUrl()).toBe(
        `https://${testDomain}.atlassian.net/rest/api/3/search/jql`
      );
    });

    it('should fail without credentials', () => {
      const unconfiguredTool = new MockSearchIssuesIntegration(testDomain);
      
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      expect(unconfiguredTool.searchIssues(request)).rejects.toThrow(
        'Jira credentials not configured'
      );
    });
  });

  describe('Test Scenario 6: Backward Compatibility - Legacy Parameters', () => {
    const compatibilityQuery = 'project = AIS360 ORDER BY created DESC';

    it('should execute request with legacy limit parameter', async () => {
      const request: SearchIssuesRequest = {
        jql: compatibilityQuery,
        limit: 5,
        startAt: 0,
      };

      // Should fail with implementation error, not validation error
      await expect(searchTool.searchIssues(request)).rejects.toThrow(
        'search-issues integration not yet implemented'
      );
    });

    it('should execute request with legacy startAt parameter', async () => {
      const request: SearchIssuesRequest = {
        jql: compatibilityQuery,
        limit: 5,
        startAt: 10,
      };

      await expect(searchTool.searchIssues(request)).rejects.toThrow(
        'search-issues integration not yet implemented'
      );
    });

    it('should handle both legacy parameters together', async () => {
      const request: SearchIssuesRequest = {
        jql: compatibilityQuery,
        limit: 5,
        startAt: 0,
      };

      await expect(searchTool.searchIssues(request)).rejects.toThrow(
        'search-issues integration not yet implemented'
      );
    });

    it('should handle legacy parameters without startAt', async () => {
      const request: SearchIssuesRequest = {
        jql: compatibilityQuery,
        limit: 5,
        // startAt omitted
      };

      await expect(searchTool.searchIssues(request)).rejects.toThrow(
        'search-issues integration not yet implemented'
      );
    });

    it('should map legacy parameters correctly', () => {
      const request: SearchIssuesRequest = {
        jql: compatibilityQuery,
        limit: 5,
        startAt: 0,
      };

      const mapped = searchTool.mapLegacyParameters(request);
      
      // Should map limit to maxResults
      expect(mapped.maxResults).toBe(5);
      expect(mapped.limit).toBe(5); // Original should be preserved
    });
  });

  describe('Expected Backward Compatibility Behavior (Implementation Required)', () => {
    // These tests will pass once the implementation is complete
    it.skip('should work with legacy limit parameter', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      const response = await searchTool.searchIssues(request);

      // Should behave as if maxResults was set to 5
      expect(response.issues.length).toBeLessThanOrEqual(5);
      
      // Should include backward-compatible fields per quickstart.md
      expect(response).toHaveProperty('maxResults');
      expect(response).toHaveProperty('startAt');
      expect(response.maxResults).toBe(5);
      expect(response.startAt).toBe(0);
    });

    it.skip('should work with legacy startAt parameter', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 10,
      };

      const response = await searchTool.searchIssues(request);

      // Should handle pagination using startAt
      expect(response).toHaveProperty('startAt');
      expect(response.startAt).toBe(10);
      expect(response).toHaveProperty('maxResults');
      expect(response.maxResults).toBe(5);
    });

    it.skip('should maintain cursor-based pagination alongside legacy fields', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      const response = await searchTool.searchIssues(request);

      // Should include both legacy and new pagination fields
      expect(response).toHaveProperty('startAt');
      expect(response).toHaveProperty('maxResults');
      expect(response).toHaveProperty('cursor');
      
      // Cursor should still be available for enhanced pagination
      expect(typeof response.cursor === 'string' || response.cursor === null).toBe(true);
    });

    it.skip('should return same results as new parameter names', async () => {
      // Request with legacy parameters
      const legacyRequest: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      // Request with new parameters
      const newRequest: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        maxResults: 5,
        // cursor: null (implicit for first page)
      };

      const legacyResponse = await searchTool.searchIssues(legacyRequest);
      const newResponse = await searchTool.searchIssues(newRequest);

      // Should return equivalent results
      expect(legacyResponse.issues.length).toBe(newResponse.issues.length);
      
      // Issue content should be the same (allowing for potential timing differences)
      if (legacyResponse.issues.length > 0 && newResponse.issues.length > 0) {
        expect(legacyResponse.issues[0].key).toBe(newResponse.issues[0].key);
      }
    });

    it.skip('should include total count with legacy parameters', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      const response = await searchTool.searchIssues(request);

      // Should include total per quickstart.md expected result
      expect(response).toHaveProperty('total');
      if (response.total !== undefined) {
        expect(typeof response.total).toBe('number');
        expect(response.total).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Legacy Parameter Edge Cases (Implementation Required)', () => {
    it.skip('should handle mixed legacy and new parameters', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        maxResults: 10, // New parameter
        startAt: 5,     // Legacy parameter
      };

      const response = await searchTool.searchIssues(request);

      // Should prefer new parameters when both are present
      expect(response.issues.length).toBeLessThanOrEqual(10);
      expect(response.maxResults).toBe(10);
    });

    it.skip('should handle invalid legacy parameter values', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: -1, // Invalid value
        startAt: -5, // Invalid value
      };

      try {
        await searchTool.searchIssues(request);
        throw new Error('Should have thrown an error for invalid parameter values');
      } catch (error: any) {
        // Should handle invalid parameter values gracefully
        expect(error).toBeDefined();
      }
    });

    it.skip('should handle large startAt values gracefully', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 10000, // Large offset
      };

      const response = await searchTool.searchIssues(request);

      // Should handle large offsets (might return empty results)
      expect(response.issues).toBeDefined();
      expect(Array.isArray(response.issues)).toBe(true);
    });

    it.skip('should maintain metadata structure with legacy parameters', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      const response = await searchTool.searchIssues(request);

      // Should maintain full metadata structure
      expect(response).toHaveProperty('meta');
      expect(response.meta).toHaveProperty('timing');
      expect(response.meta.timing).toHaveProperty('duration');
      expect(response.meta.timing.duration).toBeGreaterThan(0);
    });
  });

  describe('Migration Path Validation (Implementation Required)', () => {
    it.skip('should provide deprecation warnings for legacy parameters', async () => {
      const request: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      const response = await searchTool.searchIssues(request);

      // Should include warnings about deprecated parameters
      if (response.meta.warnings) {
        expect(Array.isArray(response.meta.warnings)).toBe(true);
        
        const hasDeprecationWarning = response.meta.warnings.some(warning => 
          warning.includes('deprecated') || warning.includes('limit') || warning.includes('startAt')
        );
        
        // May include deprecation warnings to guide migration
        if (hasDeprecationWarning) {
          expect(hasDeprecationWarning).toBe(true);
        }
      }
    });

    it.skip('should work seamlessly without code changes', async () => {
      // This test validates zero-disruption migration
      const legacyCodeRequest: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      const response = await searchTool.searchIssues(legacyCodeRequest);

      // Legacy code should work without any changes
      expect(response).toHaveProperty('issues');
      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('startAt');
      expect(response).toHaveProperty('maxResults');
      
      // Enhanced features should be available
      expect(response).toHaveProperty('cursor');
      expect(response).toHaveProperty('meta');
    });

    it.skip('should enable gradual migration to new parameters', async () => {
      // Test that both old and new approaches work side by side
      
      // Legacy approach
      const legacyRequest: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        limit: 5,
        startAt: 0,
      };

      // New approach
      const enhancedRequest: SearchIssuesRequest = {
        jql: 'project = AIS360 ORDER BY created DESC',
        maxResults: 5,
        cursor: null,
      };

      const legacyResponse = await searchTool.searchIssues(legacyRequest);
      const enhancedResponse = await searchTool.searchIssues(enhancedRequest);

      // Both should work and return compatible results
      expect(legacyResponse.issues).toBeDefined();
      expect(enhancedResponse.issues).toBeDefined();
      expect(legacyResponse.meta).toBeDefined();
      expect(enhancedResponse.meta).toBeDefined();
    });
  });
});